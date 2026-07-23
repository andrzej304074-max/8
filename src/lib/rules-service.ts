import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { items, listings, ruleExecutions, rules } from "@/db/schema";
import { evaluateRule } from "@/domain/rules/engine";
import { daysInStock } from "@/domain/inventory/staleness";
import {
  actionSchema,
  conditionsSchema,
  type RuleAction,
  type RuleConditions,
  type RuleContext,
  type RuleEffect,
} from "@/domain/rules/types";
import { logEvent } from "@/lib/event-log";

export interface RuleCandidate {
  listingId: number;
  itemId: number;
  itemName: string;
  currentPriceGr: number | null;
  daysListed: number;
  effect: RuleEffect | null;
  blockedReason?: string;
}

export interface DryRunResult {
  ruleName: string;
  /** Kandydaci z realnym efektem — tyle przedmiotów reguła by dotknęła. */
  actionable: RuleCandidate[];
  /** Dopasowani, ale zablokowani (limit / próg ceny) — pokazani osobno. */
  blocked: RuleCandidate[];
  /** Ile jeszcze wykonań zostało w limicie reguły (null = bez limitu). */
  remainingExecutions: number | null;
}

function parseRule(raw: typeof rules.$inferSelect):
  | { conditions: RuleConditions; action: RuleAction }
  | null {
  const conditions = conditionsSchema.safeParse(JSON.parse(raw.conditions));
  const action = actionSchema.safeParse(JSON.parse(raw.actions));
  if (!conditions.success || !action.success) return null;
  return { conditions: conditions.data, action: action.data };
}

function daysBetween(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

/** Ładuje aktywne ogłoszenia (opublikowane) i ich konteksty dla reguły. */
async function buildContexts(ruleId: number, now: Date): Promise<RuleContext[]> {
  const publishedListings = await db
    .select()
    .from(listings)
    .where(eq(listings.status, "published"));
  if (publishedListings.length === 0) return [];

  const itemIds = [...new Set(publishedListings.map((l) => l.itemId))];
  const itemRows = await db.select().from(items).where(inArray(items.id, itemIds));
  const itemById = new Map(itemRows.map((i) => [i.id, i]));

  const execRows = await db
    .select()
    .from(ruleExecutions)
    .where(eq(ruleExecutions.ruleId, ruleId));
  const execCountByListing = new Map<number, number>();
  for (const row of execRows) {
    execCountByListing.set(row.listingId, (execCountByListing.get(row.listingId) ?? 0) + 1);
  }

  return publishedListings.map((listing) => {
    const item = itemById.get(listing.itemId);
    return {
      listingId: listing.id,
      itemId: listing.itemId,
      itemName: item?.name ?? `#${listing.itemId}`,
      status: listing.status,
      priceGr: listing.priceGr,
      views: listing.views,
      likes: listing.likes,
      daysListed: daysBetween(listing.publishedAt, now),
      daysInStock: item ? daysInStock(item.createdAt, now) : 0,
      priorExecutions: execCountByListing.get(listing.id) ?? 0,
    };
  });
}

/** Podgląd na sucho — zero zmian w bazie. */
export async function dryRunRule(ruleId: number, now: Date = new Date()): Promise<DryRunResult | null> {
  const [rule] = await db.select().from(rules).where(eq(rules.id, ruleId));
  if (!rule) return null;
  const parsed = parseRule(rule);
  if (!parsed) return null;

  const contexts = await buildContexts(ruleId, now);
  const actionable: RuleCandidate[] = [];
  const blocked: RuleCandidate[] = [];

  for (const ctx of contexts) {
    const result = evaluateRule(parsed.conditions, parsed.action, ctx);
    if (!result.matches) continue;
    const candidate: RuleCandidate = {
      listingId: ctx.listingId,
      itemId: ctx.itemId,
      itemName: ctx.itemName,
      currentPriceGr: ctx.priceGr,
      daysListed: ctx.daysListed,
      effect: result.effect,
      blockedReason: result.blockedReason,
    };
    if (result.effect) actionable.push(candidate);
    else blocked.push(candidate);
  }

  const remainingExecutions =
    rule.maxExecutions === null ? null : Math.max(0, rule.maxExecutions - rule.executionsCount);

  return {
    ruleName: rule.name,
    actionable,
    blocked,
    remainingExecutions,
  };
}

export interface ApplyResult {
  applied: number;
  skippedByLimit: number;
}

/**
 * Wykonuje regułę: dla każdego kandydata z efektem stosuje zmianę, zapisuje
 * wykonanie (per-item limit + audyt) i loguje do EventLog. Respektuje
 * rule-level max_executions — po wyczerpaniu limitu przerywa.
 */
export async function applyRule(ruleId: number, now: Date = new Date()): Promise<ApplyResult | null> {
  const preview = await dryRunRule(ruleId, now);
  if (!preview) return null;
  const [rule] = await db.select().from(rules).where(eq(rules.id, ruleId));
  if (!rule) return null;

  let budget =
    rule.maxExecutions === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, rule.maxExecutions - rule.executionsCount);

  let applied = 0;
  let skippedByLimit = 0;

  for (const candidate of preview.actionable) {
    if (!candidate.effect) continue;
    if (budget <= 0) {
      skippedByLimit += 1;
      continue;
    }
    await applyEffect(rule, candidate, candidate.effect);
    applied += 1;
    budget -= 1;
  }

  if (applied > 0) {
    await db
      .update(rules)
      .set({ executionsCount: rule.executionsCount + applied })
      .where(eq(rules.id, ruleId));
  }

  await logEvent({
    actor: "app",
    action: "rule.applied",
    outcome: "ok",
    detail: `Reguła „${rule.name}": zastosowano do ${applied} przedmiotów${
      skippedByLimit > 0 ? `, pominięto ${skippedByLimit} (limit reguły)` : ""
    }`,
  });

  return { applied, skippedByLimit };
}

async function applyEffect(
  rule: typeof rules.$inferSelect,
  candidate: RuleCandidate,
  effect: RuleEffect,
): Promise<void> {
  if (effect.type === "price_drop") {
    await db
      .update(listings)
      .set({ priceGr: effect.newPriceGr })
      .where(eq(listings.id, candidate.listingId));
    await db
      .update(items)
      .set({ expectedPriceGr: effect.newPriceGr })
      .where(eq(items.id, candidate.itemId));
    await recordExecution(rule.id, candidate, "price_drop", null);
    await logEvent({
      actor: "app",
      action: "rule.price_drop",
      outcome: "ok",
      detail: `„${candidate.itemName}": cena ${(effect.oldPriceGr / 100).toFixed(2)} → ${(effect.newPriceGr / 100).toFixed(2)} zł — zaktualizuj też na platformie`,
      payload: { listingId: candidate.listingId, ...effect },
    });
  } else if (effect.type === "relist") {
    // Relisting w trybie ręcznym: zamykamy stare ogłoszenie i wracamy przedmiot
    // do stanu „Gotowy", by wrócił do kolejki publikacji.
    await db
      .update(listings)
      .set({ status: "ended" })
      .where(eq(listings.id, candidate.listingId));
    await db.update(items).set({ status: "ready" }).where(eq(items.id, candidate.itemId));
    await recordExecution(rule.id, candidate, "relist", null);
    await logEvent({
      actor: "app",
      action: "rule.relist",
      outcome: "ok",
      detail: `„${candidate.itemName}": ogłoszenie zakończone, przedmiot wrócił do kolejki (zakończ też na platformie)`,
      payload: { listingId: candidate.listingId },
    });
  } else {
    await db
      .update(listings)
      .set({ refreshedAt: new Date().toISOString() })
      .where(eq(listings.id, candidate.listingId));
    await recordExecution(rule.id, candidate, "refresh", null);
    await logEvent({
      actor: "app",
      action: "rule.refresh",
      outcome: "ok",
      detail: `„${candidate.itemName}": odświeżenie — odśwież ogłoszenie na platformie, by wróciło na górę`,
      payload: { listingId: candidate.listingId },
    });
  }
}

async function recordExecution(
  ruleId: number,
  candidate: RuleCandidate,
  effect: string,
  detail: string | null,
): Promise<void> {
  await db.insert(ruleExecutions).values({
    ruleId,
    listingId: candidate.listingId,
    itemId: candidate.itemId,
    effect,
    detail,
  });
}

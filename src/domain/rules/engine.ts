import type {
  EvalResult,
  RuleAction,
  RuleClause,
  RuleConditions,
  RuleContext,
} from "./types";

function fieldValue(clause: RuleClause, ctx: RuleContext): number | string | null {
  switch (clause.field) {
    case "days_listed":
      return ctx.daysListed;
    case "days_in_stock":
      return ctx.daysInStock;
    case "views":
      return ctx.views;
    case "likes":
      return ctx.likes;
    case "price_gr":
      return ctx.priceGr;
    case "status":
      return ctx.status;
  }
}

function compare(
  actual: number | string | null,
  op: RuleClause["op"],
  expected: number | string,
): boolean {
  if (actual === null) return false;

  // Porównania tekstowe tylko dla równości/nierówności.
  if (typeof actual === "string" || typeof expected === "string") {
    const a = String(actual);
    const b = String(expected);
    if (op === "eq") return a === b;
    if (op === "neq") return a !== b;
    return false;
  }

  switch (op) {
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
  }
}

/** Czy warunki reguły są spełnione dla danego ogłoszenia. */
export function matchConditions(conditions: RuleConditions, ctx: RuleContext): boolean {
  const results = conditions.clauses.map((clause) =>
    compare(fieldValue(clause, ctx), clause.op, clause.value),
  );
  return conditions.match === "all"
    ? results.every(Boolean)
    : results.some(Boolean);
}

/**
 * Ocena reguły dla pojedynczego ogłoszenia: dopasowanie + konkretny efekt.
 * Czysta funkcja — bez bazy, bez dat "teraz" (dni są już w kontekście).
 */
export function evaluateRule(
  conditions: RuleConditions,
  action: RuleAction,
  ctx: RuleContext,
): EvalResult {
  if (!matchConditions(conditions, ctx)) {
    return { matches: false, effect: null };
  }

  if (action.type === "price_drop") {
    if (ctx.priorExecutions >= action.max_per_item) {
      return {
        matches: true,
        effect: null,
        blockedReason: `osiągnięto limit obniżek (${action.max_per_item}) dla tego przedmiotu`,
      };
    }
    if (ctx.priceGr === null) {
      return { matches: true, effect: null, blockedReason: "przedmiot nie ma ceny" };
    }
    const dropped = Math.round(ctx.priceGr * (1 - action.percent / 100));
    const newPriceGr = Math.max(action.min_price_gr, dropped);
    if (newPriceGr >= ctx.priceGr) {
      return {
        matches: true,
        effect: null,
        blockedReason: "cena już na progu minimalnym",
      };
    }
    return {
      matches: true,
      effect: { type: "price_drop", oldPriceGr: ctx.priceGr, newPriceGr },
    };
  }

  if (action.type === "relist") {
    return { matches: true, effect: { type: "relist" } };
  }

  return { matches: true, effect: { type: "refresh" } };
}

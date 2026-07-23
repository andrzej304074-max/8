import { eq } from "drizzle-orm";
import type { AiSuggestionRecord } from "@/ai/schema";
import { db } from "@/db";
import { accounts, items, listings } from "@/db/schema";
import { logEvent } from "@/lib/event-log";

/**
 * Tworzy szkic ogłoszenia dla przedmiotu na koncie — wspólne dla ręcznego
 * przycisku "Przygotuj ogłoszenie" i wykonania zadania z kolejki.
 */
export async function createListingCore(
  itemId: number,
  accountId: number,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!item || !account) {
    return { ok: false, error: "Przedmiot lub konto nie istnieje" };
  }

  // Tytuł i opis: najpierw zaakceptowana sugestia AI, potem dane przedmiotu.
  let title = item.name;
  let description = item.notes ?? "";
  if (item.aiSuggestion) {
    try {
      const record = JSON.parse(item.aiSuggestion) as AiSuggestionRecord;
      title = record.data.title;
      description = record.data.description;
    } catch {
      // uszkodzony rekord AI — zostają dane przedmiotu
    }
  }

  const [created] = await db
    .insert(listings)
    .values({
      itemId,
      accountId,
      platform: account.platform,
      title: title.slice(0, 60),
      description,
      priceGr: item.expectedPriceGr,
      status: "draft",
      createdVia: "manual",
    })
    .returning({ id: listings.id });

  if (!created) {
    return { ok: false, error: "Nie udało się utworzyć ogłoszenia" };
  }

  await logEvent({
    actor: "user",
    account: account.name,
    action: "listing.created",
    outcome: "ok",
    detail: `Szkic ogłoszenia #${created.id} dla przedmiotu „${item.name}"`,
  });

  return { ok: true, id: created.id };
}

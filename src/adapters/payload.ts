import { asc, eq } from "drizzle-orm";
import type { AiSuggestionRecord } from "@/ai/schema";
import { db } from "@/db";
import { accounts, items, listings, photos } from "@/db/schema";
import { getStorage } from "@/storage";
import type { Account, ListingPayload } from "./types";

export interface ListingBundle {
  listing: typeof listings.$inferSelect;
  item: typeof items.$inferSelect;
  account: Account;
  payload: ListingPayload;
  /** Flagi wad z sugestii AI — trafiają do ostrzeżeń paczki. */
  aiFlags: string[];
}

function splitList(value: string | null, separator: string): string[] {
  if (!value) return [];
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** Składa pełny kontekst ogłoszenia z bazy — wspólny dla strony paczki i adapterów. */
export async function loadListingBundle(listingId: number): Promise<ListingBundle | null> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId));
  if (!listing) return null;
  const [item] = await db.select().from(items).where(eq(items.id, listing.itemId));
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, listing.accountId));
  if (!item || !account) return null;

  const storage = getStorage();
  const photoRows = await db
    .select()
    .from(photos)
    .where(eq(photos.itemId, item.id))
    .orderBy(asc(photos.position));

  let aiFlags: string[] = [];
  if (item.aiSuggestion) {
    try {
      const record = JSON.parse(item.aiSuggestion) as AiSuggestionRecord;
      aiFlags = record.data.flags;
    } catch {
      aiFlags = [];
    }
  }

  return {
    listing,
    item,
    account,
    aiFlags,
    payload: {
      listingId: listing.id,
      itemId: item.id,
      title: listing.title,
      description: listing.description ?? "",
      priceGr: listing.priceGr,
      categoryPath: splitList(item.category, "/"),
      condition: item.condition,
      size: item.size,
      brand: item.brand,
      colors: splitList(item.color, ","),
      material: item.material,
      photoUrls: photoRows.map((p) => storage.publicUrl(p.processedKey ?? p.originalKey)),
    },
  };
}

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { items, listings, sales } from "@/db/schema";
import { daysInStock } from "@/domain/inventory/staleness";
import { monthKey, type SaleRecord } from "@/domain/finance/stats";

/** Ładuje wszystkie sprzedaże wzbogacone o dane ogłoszenia i przedmiotu. */
export async function loadSaleRecords(): Promise<
  Array<SaleRecord & { itemName: string; soldAt: string }>
> {
  const saleRows = await db.select().from(sales);
  if (saleRows.length === 0) return [];

  const listingIds = [...new Set(saleRows.map((s) => s.listingId))];
  const listingRows = await db.select().from(listings).where(inArray(listings.id, listingIds));
  const listingById = new Map(listingRows.map((l) => [l.id, l]));

  const itemIds = [...new Set(listingRows.map((l) => l.itemId))];
  const itemRows =
    itemIds.length > 0 ? await db.select().from(items).where(inArray(items.id, itemIds)) : [];
  const itemById = new Map(itemRows.map((i) => [i.id, i]));

  return saleRows.map((sale) => {
    const listing = listingById.get(sale.listingId);
    const item = listing ? itemById.get(listing.itemId) : undefined;
    return {
      finalPriceGr: sale.finalPriceGr,
      commissionGr: sale.commissionGr,
      shippingGr: sale.shippingGr,
      marginGr: sale.marginGr ?? 0,
      soldAt: sale.soldAt,
      publishedAt: listing?.publishedAt ?? null,
      category: item?.category ?? null,
      brand: item?.brand ?? null,
      itemName: item?.name ?? `#${sale.listingId}`,
    };
  });
}

export interface UnsoldItem {
  id: number;
  name: string;
  category: string | null;
  expectedPriceGr: number | null;
  days: number;
  priceBucket: string;
}

/** Przedmioty wciąż niesprzedane, z podziałem po cenie/kategorii/wieku. */
export async function loadUnsoldItems(now: Date = new Date()): Promise<UnsoldItem[]> {
  const rows = await db
    .select()
    .from(items)
    .where(inArray(items.status, ["draft", "ready", "listed", "reserved"]));
  return rows.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    expectedPriceGr: item.expectedPriceGr,
    days: daysInStock(item.createdAt, now),
    priceBucket: priceBucket(item.expectedPriceGr),
  }));
}

function priceBucket(gr: number | null): string {
  if (gr === null) return "bez ceny";
  const zl = gr / 100;
  if (zl < 20) return "do 20 zł";
  if (zl < 50) return "20–50 zł";
  if (zl < 100) return "50–100 zł";
  return "ponad 100 zł";
}

/** Podsumowania miesięczne dla rozliczeń. */
export interface MonthlySummary {
  month: string;
  count: number;
  revenueGr: number;
  commissionGr: number;
  marginGr: number;
}

export function summarizeByMonth(
  records: Array<SaleRecord>,
): MonthlySummary[] {
  const map = new Map<string, MonthlySummary>();
  for (const sale of records) {
    const month = monthKey(sale.soldAt);
    const entry =
      map.get(month) ?? { month, count: 0, revenueGr: 0, commissionGr: 0, marginGr: 0 };
    entry.count += 1;
    entry.revenueGr += sale.finalPriceGr;
    entry.commissionGr += sale.commissionGr;
    entry.marginGr += sale.marginGr;
    map.set(month, entry);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/** Zlicza sprzedane vs niesprzedane dla rotacji magazynu. */
export async function countForRotation(): Promise<{ sold: number; unsold: number }> {
  const soldRows = await db.select({ id: items.id }).from(items).where(eq(items.status, "sold"));
  const unsoldRows = await db
    .select({ id: items.id })
    .from(items)
    .where(inArray(items.status, ["draft", "ready", "listed", "reserved"]));
  return { sold: soldRows.length, unsold: unsoldRows.length };
}

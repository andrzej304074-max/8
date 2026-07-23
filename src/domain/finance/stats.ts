// Czysta logika statystyk finansowych — bez bazy, bez dat "teraz".
// Wszystkie kwoty w groszach (integer).

/** Marża = cena finalna − prowizja − koszt wysyłki − cena zakupu. */
export function computeMarginGr(input: {
  finalPriceGr: number;
  commissionGr: number;
  shippingGr: number;
  purchasePriceGr: number | null;
}): number {
  return (
    input.finalPriceGr -
    input.commissionGr -
    input.shippingGr -
    (input.purchasePriceGr ?? 0)
  );
}

export interface SaleRecord {
  finalPriceGr: number;
  commissionGr: number;
  shippingGr: number;
  marginGr: number;
  soldAt: string;
  /** Data publikacji ogłoszenia — do liczenia czasu do sprzedaży. */
  publishedAt: string | null;
  category: string | null;
  brand: string | null;
}

export interface Summary {
  count: number;
  revenueGr: number;
  marginGr: number;
  /** Średni czas od wystawienia do sprzedaży w dniach (null gdy brak dat). */
  avgDaysToSale: number | null;
}

export function summarize(sales: SaleRecord[]): Summary {
  const revenueGr = sales.reduce((sum, s) => sum + s.finalPriceGr, 0);
  const marginGr = sales.reduce((sum, s) => sum + s.marginGr, 0);

  const durations = sales
    .filter((s) => s.publishedAt !== null)
    .map((s) => daysBetween(s.publishedAt as string, s.soldAt))
    .filter((d) => d >= 0);
  const avgDaysToSale =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  return { count: sales.length, revenueGr, marginGr, avgDaysToSale };
}

export interface GroupStat {
  key: string;
  count: number;
  revenueGr: number;
  marginGr: number;
}

/** Grupuje sprzedaże po wymiarze (kategoria/marka), sortując po marży malejąco. */
export function groupBy(
  sales: SaleRecord[],
  dimension: "category" | "brand",
): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const sale of sales) {
    const key = sale[dimension] ?? "(brak)";
    const entry = map.get(key) ?? { key, count: 0, revenueGr: 0, marginGr: 0 };
    entry.count += 1;
    entry.revenueGr += sale.finalPriceGr;
    entry.marginGr += sale.marginGr;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.marginGr - a.marginGr);
}

/** Rotacja magazynu = sprzedane / (sprzedane + wciąż w magazynie) w oknie. */
export function inventoryRotation(soldCount: number, unsoldCount: number): number {
  const total = soldCount + unsoldCount;
  return total === 0 ? 0 : soldCount / total;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000,
  );
}

/** Klucz miesiąca "YYYY-MM" z daty ISO. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema";
import { groszeToCsvNumber, toCsv } from "@/lib/csv";
import { daysInStock } from "@/domain/inventory/staleness";
import { STATUS_LABELS } from "@/lib/labels";

/** Eksport całego magazynu do CSV. */
export async function GET() {
  const rows = await db.select().from(items).orderBy(desc(items.createdAt));
  const now = new Date();
  const csv = toCsv(
    [
      "Nazwa",
      "Marka",
      "Kategoria",
      "Rozmiar",
      "Stan",
      "Kolor",
      "Material",
      "Cena zakupu",
      "Cena oczekiwana",
      "Koszt wysylki",
      "Lokalizacja",
      "Status",
      "Dni w magazynie",
    ],
    rows.map((item) => [
      item.name,
      item.brand,
      item.category,
      item.size,
      item.condition,
      item.color,
      item.material,
      groszeToCsvNumber(item.purchasePriceGr),
      groszeToCsvNumber(item.expectedPriceGr),
      groszeToCsvNumber(item.shippingCostGr),
      item.location,
      STATUS_LABELS[item.status],
      daysInStock(item.createdAt, now),
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="magazyn-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

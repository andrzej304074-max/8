import { NextResponse } from "next/server";
import { groszeToCsvNumber, toCsv } from "@/lib/csv";
import { loadSaleRecords } from "@/lib/stats-service";

/** Eksport wszystkich sprzedaży do CSV (Excel PL: średnik + BOM). */
export async function GET() {
  const records = await loadSaleRecords();
  const csv = toCsv(
    ["Przedmiot", "Data sprzedazy", "Cena finalna", "Prowizja", "Wysylka", "Marza", "Kategoria", "Marka"],
    records.map((r) => [
      r.itemName,
      r.soldAt.slice(0, 10),
      groszeToCsvNumber(r.finalPriceGr),
      groszeToCsvNumber(r.commissionGr),
      groszeToCsvNumber(r.shippingGr),
      groszeToCsvNumber(r.marginGr),
      r.category,
      r.brand,
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sprzedaz-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

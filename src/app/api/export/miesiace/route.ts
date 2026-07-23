import { NextResponse } from "next/server";
import { groszeToCsvNumber, toCsv } from "@/lib/csv";
import { loadSaleRecords, summarizeByMonth } from "@/lib/stats-service";

/** Miesięczne podsumowanie do celów rozliczeniowych. */
export async function GET() {
  const records = await loadSaleRecords();
  const monthly = summarizeByMonth(records);
  const csv = toCsv(
    ["Miesiac", "Liczba sprzedazy", "Przychod", "Prowizje", "Marza"],
    monthly.map((m) => [
      m.month,
      m.count,
      groszeToCsvNumber(m.revenueGr),
      groszeToCsvNumber(m.commissionGr),
      groszeToCsvNumber(m.marginGr),
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="podsumowanie-miesieczne-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

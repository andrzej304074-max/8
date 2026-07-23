import { inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { items, photos } from "@/db/schema";
import { formatPln } from "@/domain/finance/money";
import {
  daysInStock,
  suggestAction,
  type StaleAction,
} from "@/domain/inventory/staleness";
import { STATUS_LABELS } from "@/lib/labels";
import { getStorage } from "@/storage";

export const dynamic = "force-dynamic";

const ACTION_STYLES: Record<StaleAction, string> = {
  odswiez: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  obniz_cene: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  przenies: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  wycofaj: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default async function ZalegajacePage() {
  // "Bez sprzedaży" = wszystko, co fizycznie leży w magazynie.
  const rows = await db
    .select()
    .from(items)
    .where(inArray(items.status, ["draft", "ready", "listed", "reserved"]));

  const storage = getStorage();
  const photoByItem = new Map<number, string>();
  if (rows.length > 0) {
    const photoRows = await db
      .select()
      .from(photos)
      .where(
        inArray(
          photos.itemId,
          rows.map((r) => r.id),
        ),
      );
    photoRows.sort((a, b) => a.position - b.position);
    for (const p of photoRows) {
      if (p.isMain || !photoByItem.has(p.itemId)) {
        photoByItem.set(p.itemId, storage.publicUrl(p.processedKey ?? p.originalKey));
      }
    }
  }

  const withDays = rows
    .map((item) => ({
      item,
      days: daysInStock(item.createdAt),
      photoUrl: photoByItem.get(item.id) ?? null,
    }))
    .sort((a, b) => b.days - a.days);

  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-xl font-semibold">Zalegające</h1>
        <Link href="/magazyn" className="text-sm underline">
          ← wróć do magazynu
        </Link>
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Przedmioty bez sprzedaży, od najdłużej leżących. Sugestie eskalują progami:
        7 dni → odśwież, 21 → obniż cenę, 45 → przenieś na inne konto, 90 → wycofaj.
      </p>

      {withDays.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nic nie zalega — magazyn jest pusty albo wszystko sprzedane.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-3 py-2 font-medium">Zdjęcie</th>
                <th className="px-3 py-2 font-medium">Nazwa</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Dni w magazynie</th>
                <th className="px-3 py-2 font-medium">Cena oczekiwana</th>
                <th className="px-3 py-2 font-medium">Sugestia</th>
              </tr>
            </thead>
            <tbody>
              {withDays.map(({ item, days, photoUrl }) => {
                const suggestion = suggestAction(days);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-zinc-200 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-1.5">
                      {photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={photoUrl} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <span className="inline-block h-10 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/magazyn/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{STATUS_LABELS[item.status]}</td>
                    <td className="px-3 py-2 font-medium">{days}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {item.expectedPriceGr !== null ? formatPln(item.expectedPriceGr) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {suggestion ? (
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[suggestion.action]}`}
                        >
                          {suggestion.label}
                        </span>
                      ) : (
                        <span className="text-zinc-400">czekaj</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

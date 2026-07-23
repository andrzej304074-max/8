import { desc } from "drizzle-orm";
import { db } from "@/db";
import { items, type ItemStatus } from "@/db/schema";
import { formatPln } from "@/domain/finance/money";

// Dane magazynu muszą być zawsze świeże — bez prerenderu w czasie builda.
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Szkic",
  ready: "Gotowy",
  listed: "Wystawiony",
  reserved: "Zarezerwowany",
  sold: "Sprzedany",
  returned: "Zwrot",
  archived: "Zarchiwizowany",
};

export default async function MagazynPage() {
  const allItems = await db.select().from(items).orderBy(desc(items.createdAt));

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Magazyn</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {allItems.length}{" "}
          {allItems.length === 1 ? "przedmiot" : "przedmiotów"}
        </span>
      </div>

      {allItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="mb-1 font-medium">Magazyn jest pusty</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Dodawanie przedmiotów (zdjęcia, filtry, edycja) pojawi się w Etapie 2.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-3 py-2 font-medium">Nazwa</th>
                <th className="px-3 py-2 font-medium">Marka</th>
                <th className="px-3 py-2 font-medium">Rozmiar</th>
                <th className="px-3 py-2 font-medium">Stan</th>
                <th className="px-3 py-2 font-medium">Cena oczekiwana</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Lokalizacja</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-200 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.brand ?? "—"}</td>
                  <td className="px-3 py-2">{item.size ?? "—"}</td>
                  <td className="px-3 py-2">{item.condition ?? "—"}</td>
                  <td className="px-3 py-2">
                    {item.expectedPriceGr !== null
                      ? formatPln(item.expectedPriceGr)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABELS[item.status]}</td>
                  <td className="px-3 py-2">{item.location ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { formatPln } from "@/domain/finance/money";
import { groupBy, inventoryRotation, summarize } from "@/domain/finance/stats";
import {
  countForRotation,
  loadSaleRecords,
  loadUnsoldItems,
  summarizeByMonth,
} from "@/lib/stats-service";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function GroupTable({
  title,
  groups,
}: {
  title: string;
  groups: ReturnType<typeof groupBy>;
}) {
  const best = groups.slice(0, 5);
  const worst = groups.length > 5 ? groups.slice(-3).reverse() : [];
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {groups.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Brak danych.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">Szt.</th>
                <th className="px-3 py-2 font-medium">Przychód</th>
                <th className="px-3 py-2 font-medium">Marża</th>
              </tr>
            </thead>
            <tbody>
              {best.map((g) => (
                <tr key={g.key} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                  <td className="px-3 py-2">{g.key}</td>
                  <td className="px-3 py-2">{g.count}</td>
                  <td className="px-3 py-2">{formatPln(g.revenueGr)}</td>
                  <td className="px-3 py-2">{formatPln(g.marginGr)}</td>
                </tr>
              ))}
              {worst.length > 0 ? (
                <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                  <td colSpan={4} className="px-3 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                    najsłabsze:
                  </td>
                </tr>
              ) : null}
              {worst.map((g) => (
                <tr key={`w-${g.key}`} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                  <td className="px-3 py-2">{g.key}</td>
                  <td className="px-3 py-2">{g.count}</td>
                  <td className="px-3 py-2">{formatPln(g.revenueGr)}</td>
                  <td className="px-3 py-2">{formatPln(g.marginGr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function StatystykiPage() {
  const records = await loadSaleRecords();
  const summary = summarize(records);
  const byCategory = groupBy(records, "category");
  const byBrand = groupBy(records, "brand");
  const monthly = summarizeByMonth(records);
  const rotation = await countForRotation();
  const unsold = await loadUnsoldItems();

  // Rozbicie "co się nie sprzedaje" po koszyku cenowym.
  const byPriceBucket = new Map<string, { count: number; oldestDays: number }>();
  for (const item of unsold) {
    const entry = byPriceBucket.get(item.priceBucket) ?? { count: 0, oldestDays: 0 };
    entry.count += 1;
    entry.oldestDays = Math.max(entry.oldestDays, item.days);
    byPriceBucket.set(item.priceBucket, entry);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Statystyki i finanse</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="/api/export/sprzedaz"
            className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Eksport sprzedaży CSV
          </a>
          <a
            href="/api/export/magazyn"
            className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Eksport magazynu CSV
          </a>
          <a
            href="/api/export/backup"
            className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Kopia zapasowa bazy
          </a>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sprzedaże" value={String(summary.count)} />
        <Stat label="Przychód" value={formatPln(summary.revenueGr)} />
        <Stat label="Marża łącznie" value={formatPln(summary.marginGr)} />
        <Stat
          label="Śr. czas do sprzedaży"
          value={summary.avgDaysToSale !== null ? `${summary.avgDaysToSale} dni` : "—"}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Rotacja magazynu"
          value={`${Math.round(inventoryRotation(rotation.sold, rotation.unsold) * 100)}%`}
        />
        <Stat label="Sprzedanych łącznie" value={String(rotation.sold)} />
        <Stat label="Wciąż w magazynie" value={String(rotation.unsold)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GroupTable title="Kategorie — najlepsze i najgorsze" groups={byCategory} />
        <GroupTable title="Marki — najlepsze i najgorsze" groups={byBrand} />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Co się nie sprzedaje — rozbicie po cenie</h2>
        {unsold.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nic nie zalega — brak niesprzedanych przedmiotów.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-3 py-2 font-medium">Przedział cenowy</th>
                  <th className="px-3 py-2 font-medium">Liczba przedmiotów</th>
                  <th className="px-3 py-2 font-medium">Najstarszy (dni)</th>
                </tr>
              </thead>
              <tbody>
                {[...byPriceBucket.entries()].map(([bucket, data]) => (
                  <tr key={bucket} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                    <td className="px-3 py-2">{bucket}</td>
                    <td className="px-3 py-2">{data.count}</td>
                    <td className="px-3 py-2">{data.oldestDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/magazyn/zalegajace" className="mt-2 inline-block text-sm underline">
          zobacz listę zalegających z sugestiami →
        </Link>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Podsumowanie miesięczne (rozliczenia)</h2>
          <a href="/api/export/miesiace" className="text-sm underline">
            eksport CSV →
          </a>
        </div>
        {monthly.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Brak sprzedaży do podsumowania.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-3 py-2 font-medium">Miesiąc</th>
                  <th className="px-3 py-2 font-medium">Sprzedaże</th>
                  <th className="px-3 py-2 font-medium">Przychód</th>
                  <th className="px-3 py-2 font-medium">Prowizje</th>
                  <th className="px-3 py-2 font-medium">Marża</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month} className="border-b border-zinc-200 last:border-0 dark:border-zinc-800">
                    <td className="px-3 py-2 font-medium">{m.month}</td>
                    <td className="px-3 py-2">{m.count}</td>
                    <td className="px-3 py-2">{formatPln(m.revenueGr)}</td>
                    <td className="px-3 py-2">{formatPln(m.commissionGr)}</td>
                    <td className="px-3 py-2">{formatPln(m.marginGr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

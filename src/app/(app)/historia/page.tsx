import { and, desc, eq, isNotNull, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { eventLog } from "@/db/schema";
import { HistoryFilters } from "./filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function HistoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const akcja = asString(params.akcja);
  const konto = asString(params.konto);
  const wynik = asString(params.wynik);
  const strona = Math.max(1, Number(asString(params.strona) ?? "1") || 1);

  const conditions: SQL[] = [];
  if (akcja) conditions.push(eq(eventLog.action, akcja));
  if (konto) conditions.push(eq(eventLog.account, konto));
  if (wynik === "ok" || wynik === "error") {
    conditions.push(eq(eventLog.outcome, wynik));
  }

  const rows = await db
    .select()
    .from(eventLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(eventLog.createdAt), desc(eventLog.id))
    .limit(PAGE_SIZE + 1)
    .offset((strona - 1) * PAGE_SIZE);

  const hasNext = rows.length > PAGE_SIZE;
  const visible = rows.slice(0, PAGE_SIZE);

  const actionOptions = (
    await db.selectDistinct({ v: eventLog.action }).from(eventLog)
  )
    .map((r) => r.v)
    .sort();
  const accountOptions = (
    await db
      .selectDistinct({ v: eventLog.account })
      .from(eventLog)
      .where(isNotNull(eventLog.account))
  )
    .map((r) => r.v)
    .filter((v): v is string => v !== null)
    .sort();

  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    if (akcja) p.set("akcja", akcja);
    if (konto) p.set("konto", konto);
    if (wynik) p.set("wynik", wynik);
    if (page > 1) p.set("strona", String(page));
    return `/historia?${p.toString()}`;
  };

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Historia</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          niezmienialny dziennik operacji
        </span>
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Każda operacja dotykająca platformy zostawia tu ślad: co, kiedy, na jakim
        koncie i z jakim skutkiem. Kolumna „Kto" rozróżnia, co zrobiła aplikacja,
        a co Ty.
      </p>

      <div className="mb-4">
        <HistoryFilters
          current={{ akcja, konto, wynik }}
          actions={actionOptions}
          accounts={accountOptions}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Brak zdarzeń — pojawią się przy operacjach na ogłoszeniach.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-3 py-2 font-medium">Czas</th>
                <th className="px-3 py-2 font-medium">Kto</th>
                <th className="px-3 py-2 font-medium">Konto</th>
                <th className="px-3 py-2 font-medium">Akcja</th>
                <th className="px-3 py-2 font-medium">Wynik</th>
                <th className="px-3 py-2 font-medium">Szczegóły</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-zinc-200 align-top last:border-0 dark:border-zinc-800"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-500 dark:text-zinc-400">
                    {event.createdAt.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2">
                    {event.actor === "user" ? "Ty" : "Aplikacja"}
                  </td>
                  <td className="px-3 py-2">{event.account ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{event.action}</td>
                  <td className="px-3 py-2">
                    {event.outcome === "ok" ? (
                      <span className="text-green-700 dark:text-green-400">OK</span>
                    ) : (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Błąd
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {event.detail ?? "—"}
                    {event.payload ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
                          payload
                        </summary>
                        <pre className="mt-1 max-w-xl overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                          {JSON.stringify(JSON.parse(event.payload), null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex gap-3 text-sm">
        {strona > 1 ? (
          <Link href={pageHref(strona - 1)} className="underline">
            ← nowsze
          </Link>
        ) : null}
        {hasNext ? (
          <Link href={pageHref(strona + 1)} className="underline">
            starsze →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

import { and, asc, count, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { accounts, items, jobs } from "@/db/schema";
import { config } from "@/lib/config";
import { daysInStock, suggestAction } from "@/domain/inventory/staleness";
import { runTick } from "@/lib/tick";
import { TodoList, type TodoJob } from "./todo-list";

export const dynamic = "force-dynamic";

function timeLabel(tz: string, iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  // Odporność na restarty: wejście na Dashboard domyka zaległości.
  await runTick();
  const tz = config.APP_TIMEZONE;

  const dueJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "due"))
    .orderBy(asc(jobs.scheduledAt));

  const accountNameById = new Map(
    (await db.select().from(accounts)).map((a) => [a.id, a.name]),
  );
  const jobItemIds = [
    ...new Set(dueJobs.map((j) => j.itemId).filter((v): v is number => v !== null)),
  ];
  const jobItems =
    jobItemIds.length > 0
      ? await db.select().from(items).where(inArray(items.id, jobItemIds))
      : [];
  const itemNameById = new Map(jobItems.map((i) => [i.id, i.name]));

  const todoJobs: TodoJob[] = dueJobs.map((job) => ({
    id: job.id,
    itemId: job.itemId,
    itemName: job.itemId !== null ? (itemNameById.get(job.itemId) ?? `#${job.itemId}`) : "—",
    accountName:
      job.accountId !== null
        ? (accountNameById.get(job.accountId) ?? `konto #${job.accountId}`)
        : "—",
    timeLabel: timeLabel(tz, job.scheduledAt),
  }));

  const [readyRow] = await db
    .select({ n: count() })
    .from(items)
    .where(eq(items.status, "ready"));
  const [listedRow] = await db
    .select({ n: count() })
    .from(items)
    .where(eq(items.status, "listed"));
  const [scheduledRow] = await db
    .select({ n: count() })
    .from(jobs)
    .where(inArray(jobs.status, ["pending", "paused"]));

  // Alerty: przedmioty zalegające, którym warto się przyjrzeć.
  const activeItems = await db
    .select()
    .from(items)
    .where(inArray(items.status, ["listed", "reserved"]));
  const alerts = activeItems
    .map((item) => ({ item, days: daysInStock(item.createdAt) }))
    .filter(({ days }) => suggestAction(days) !== null)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Do zrobienia dziś" value={todoJobs.length} />
        <Stat label="Gotowe do wystawienia" value={readyRow?.n ?? 0} />
        <Stat label="Wystawione" value={listedRow?.n ?? 0} />
        <Stat label="Zaplanowane w kolejce" value={scheduledRow?.n ?? 0} />
      </div>

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Do zrobienia dziś</h2>
          <Link href="/kolejka" className="text-sm underline">
            zobacz kolejkę →
          </Link>
        </div>
        <TodoList jobs={todoJobs} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Alerty — przedmioty zalegające</h2>
          <Link href="/magazyn/zalegajace" className="text-sm underline">
            wszystkie →
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Brak alertów — nic nie zalega ponad próg.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {alerts.map(({ item, days }) => {
              const suggestion = suggestAction(days);
              return (
                <li key={item.id} className="flex items-center gap-2 p-3">
                  <Link
                    href={`/magazyn/${item.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                  >
                    {item.name}
                  </Link>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {days} dni
                  </span>
                  {suggestion ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {suggestion.label}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

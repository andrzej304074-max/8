import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { accounts, items, jobs } from "@/db/schema";
import { config } from "@/lib/config";
import { parseScheduleSettings } from "@/lib/schedule-settings";
import { runTick } from "@/lib/tick";
import {
  dayKeyInZone,
  nextDayKey,
  zonedTimeToUtc,
} from "@/domain/scheduling/timezone";
import { GeneratePanel, type GenerateAccount } from "./generate-panel";
import { QueueCalendar, type CalendarDay, type QueueJob } from "./queue-calendar";

export const dynamic = "force-dynamic";

const VISIBLE_DAYS = 14;

function timeLabel(tz: string, iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dayLabel(tz: string, dayKey: string): string {
  const noon = zonedTimeToUtc(tz, dayKey, 12 * 60);
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(noon);
}

export default async function KolejkaPage() {
  // Odporność na restarty: przy każdym wejściu domykamy zaległości.
  await runTick();

  const tz = config.APP_TIMEZONE;
  const now = new Date();
  const todayKey = dayKeyInZone(tz, now);

  const dayKeys: string[] = [];
  let key = todayKey;
  for (let i = 0; i < VISIBLE_DAYS; i++) {
    dayKeys.push(key);
    key = nextDayKey(key);
  }
  const rangeFromIso = zonedTimeToUtc(tz, dayKeys[0]!, 0).toISOString();
  const rangeToIso = zonedTimeToUtc(tz, nextDayKey(dayKeys.at(-1)!), 0).toISOString();

  const accountRows = await db.select().from(accounts);
  const accountNameById = new Map(accountRows.map((a) => [a.id, a.name]));

  const jobRows = await db
    .select()
    .from(jobs)
    .where(
      and(
        inArray(jobs.status, ["pending", "paused", "due", "running", "done", "failed"]),
        gte(jobs.scheduledAt, rangeFromIso),
        lte(jobs.scheduledAt, rangeToIso),
      ),
    )
    .orderBy(asc(jobs.scheduledAt));

  const itemIds = [...new Set(jobRows.map((j) => j.itemId).filter((v): v is number => v !== null))];
  const itemRows =
    itemIds.length > 0
      ? await db.select().from(items).where(inArray(items.id, itemIds))
      : [];
  const itemNameById = new Map(itemRows.map((i) => [i.id, i.name]));

  const queueJobs: QueueJob[] = jobRows.map((job) => ({
    id: job.id,
    dayKey: dayKeyInZone(tz, new Date(job.scheduledAt)),
    timeLabel: timeLabel(tz, job.scheduledAt),
    scheduledAtIso: job.scheduledAt,
    status: job.status,
    itemId: job.itemId,
    itemName: job.itemId !== null ? (itemNameById.get(job.itemId) ?? `#${job.itemId}`) : "—",
    accountName:
      job.accountId !== null ? (accountNameById.get(job.accountId) ?? `konto #${job.accountId}`) : "—",
  }));

  const days: CalendarDay[] = dayKeys.map((dayKey) => ({
    dayKey,
    label: dayLabel(tz, dayKey),
    isToday: dayKey === todayKey,
    jobs: queueJobs.filter((j) => j.dayKey === dayKey),
  }));

  const readyCount = (await db.select().from(items).where(eq(items.status, "ready"))).length;
  const generateAccounts: GenerateAccount[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    hasSchedule: parseScheduleSettings(a.scheduleSettings) !== null,
  }));

  const totalScheduled = queueJobs.filter((j) =>
    ["pending", "due", "paused"].includes(j.status),
  ).length;

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3">
        <h1 className="text-xl font-semibold">Kolejka</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {totalScheduled} zaplanowanych na najbliższe {VISIBLE_DAYS} dni
        </span>
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Zaplanowane publikacje. Zadania przeżywają restart aplikacji — po
        przerwie te świeżo zaległe trafiają na listę „Do zrobienia" na
        Dashboardzie, a stare są przesuwane w najbliższe okno.
      </p>

      <GeneratePanel accounts={generateAccounts} readyCount={readyCount} />

      <QueueCalendar days={days} rangeFromIso={rangeFromIso} rangeToIso={rangeToIso} />
    </div>
  );
}

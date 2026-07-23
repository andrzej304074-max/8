import { and, eq, inArray, lte } from "drizzle-orm";
import { resolveOverdue } from "@/domain/scheduling/overdue";
import {
  dayKeyInZone,
  nextDayKey,
  weekdayInZone,
  zonedTimeToUtc,
} from "@/domain/scheduling/timezone";
import { db } from "@/db";
import { accounts, jobs } from "@/db/schema";
import { config } from "@/lib/config";
import { parseScheduleSettings } from "@/lib/schedule-settings";

/**
 * Idempotentny "tick" schedulera — serce odporności na restarty. Nie ma procesu
 * w tle: cały stan żyje w bazie, a ta funkcja (wywoływana przy wejściu na
 * Dashboard/Kolejkę oraz raz dziennie przez Vercel Cron) domyka zaległości:
 * świeżo zaległe zadania oznacza jako "due", stare przesuwa w najbliższe okno.
 */
export async function runTick(now: Date = new Date()): Promise<{
  madeDue: number;
  rescheduled: number;
}> {
  const overdue = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), lte(jobs.scheduledAt, now.toISOString())));

  if (overdue.length === 0) {
    return { madeDue: 0, rescheduled: 0 };
  }

  const toDue: number[] = [];
  const toReschedule: typeof overdue = [];
  for (const job of overdue) {
    if (resolveOverdue(job.scheduledAt, now).kind === "make_due") {
      toDue.push(job.id);
    } else {
      toReschedule.push(job);
    }
  }

  if (toDue.length > 0) {
    await db.update(jobs).set({ status: "due" }).where(inArray(jobs.id, toDue));
  }

  for (const job of toReschedule) {
    const newScheduledAt = await nextWindowStart(job.accountId, now);
    await db
      .update(jobs)
      .set({
        scheduledAt: newScheduledAt,
        attempts: job.attempts + 1,
        lastError: `Przesunięte przez tick — zaległe od ${job.scheduledAt.slice(0, 16).replace("T", " ")}`,
      })
      .where(eq(jobs.id, job.id));
  }

  return { madeDue: toDue.length, rescheduled: toReschedule.length };
}

/** Najbliższy start okna publikacji konta (jutro lub później); fallback: jutro 9:00. */
async function nextWindowStart(accountId: number | null, now: Date): Promise<string> {
  const tz = config.APP_TIMEZONE;
  let settings = null;
  if (accountId !== null) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    settings = account ? parseScheduleSettings(account.scheduleSettings) : null;
  }

  const startHour = settings?.windowStartHour ?? 9;
  const allowedDays = settings?.days ?? [0, 1, 2, 3, 4, 5, 6];

  let dayKey = nextDayKey(dayKeyInZone(tz, now));
  for (let i = 0; i < 14; i++) {
    const candidate = zonedTimeToUtc(tz, dayKey, startHour * 60);
    if (allowedDays.includes(weekdayInZone(tz, candidate))) {
      return candidate.toISOString();
    }
    dayKey = nextDayKey(dayKey);
  }
  return zonedTimeToUtc(tz, dayKey, startHour * 60).toISOString();
}

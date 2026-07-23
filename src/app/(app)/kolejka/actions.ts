"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { accounts, items, jobs } from "@/db/schema";
import { config } from "@/lib/config";
import { logEvent } from "@/lib/event-log";
import { parseScheduleSettings } from "@/lib/schedule-settings";
import { planSlots } from "@/domain/scheduling/planner";
import {
  dayKeyInZone,
  minutesFromMidnightInZone,
  nextDayKey,
  weekdayInZone,
  zonedTimeToUtc,
} from "@/domain/scheduling/timezone";

const HORIZON_DAYS = 21;

/**
 * Materializuje zadania publikacji dla przedmiotów gotowych do wystawienia na
 * danym koncie. Rozkłada je w czasie wg ustawień harmonogramu konta, respektuje
 * już zaplanowane zadania i twarde limity. Każde zadanie dostaje klucz
 * idempotencji (itemId+accountId), więc ponowne uruchomienie nie tworzy duplikatów.
 */
export async function generatePublishJobs(
  accountId: number,
): Promise<ActionResult<{ created: number }>> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return { ok: false, error: "Konto nie istnieje" };

  const settings = parseScheduleSettings(account.scheduleSettings);
  if (!settings) {
    return {
      ok: false,
      error: "Najpierw ustaw harmonogram tego konta (Ustawienia → Harmonogram).",
    };
  }

  // Przedmioty gotowe do wystawienia, które nie mają jeszcze aktywnego zadania publikacji.
  const readyItems = await db
    .select()
    .from(items)
    .where(eq(items.status, "ready"));
  if (readyItems.length === 0) {
    return { ok: false, error: "Brak przedmiotów w statusie „Gotowy” do zaplanowania." };
  }

  const activeJobs = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.accountId, accountId),
        eq(jobs.type, "publish"),
        inArray(jobs.status, ["pending", "paused", "due", "running"]),
      ),
    );
  const alreadyQueued = new Set(activeJobs.map((j) => j.itemId));
  const toSchedule = readyItems.filter((item) => !alreadyQueued.has(item.id));
  if (toSchedule.length === 0) {
    return { ok: false, error: "Wszystkie gotowe przedmioty są już w kolejce tego konta." };
  }

  const tz = config.APP_TIMEZONE;
  const now = new Date();
  const todayKey = dayKeyInZone(tz, now);

  // Horyzont dni z etykietami dnia tygodnia.
  const daysAhead: Array<{ dayKey: string; weekday: number }> = [];
  let key = todayKey;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    daysAhead.push({ dayKey: key, weekday: weekdayFromKey(tz, key) });
    key = nextDayKey(key);
  }

  // Ile zadań już wisi w każdym dniu (żeby nie przekroczyć limitu dziennego).
  const existingPerDay = new Map<string, number>();
  for (const job of activeJobs) {
    const dk = dayKeyInZone(tz, new Date(job.scheduledAt));
    existingPerDay.set(dk, (existingPerDay.get(dk) ?? 0) + 1);
  }

  const slots = planSlots({
    settings,
    count: toSchedule.length,
    daysAhead,
    nowMinutesToday: minutesFromMidnightInZone(tz, now),
    existingPerDay,
    maxPerDay: account.maxOpsPerDay,
    maxPerHour: account.maxOpsPerHour,
    random: Math.random,
  });

  const created = Math.min(slots.length, toSchedule.length);
  for (let i = 0; i < created; i++) {
    const slot = slots[i];
    const item = toSchedule[i];
    if (!slot || !item) continue;
    const scheduledAt = zonedTimeToUtc(tz, slot.dayKey, slot.minutesFromMidnight).toISOString();
    await db.insert(jobs).values({
      type: "publish",
      idempotencyKey: `publish:${item.id}:${accountId}`,
      itemId: item.id,
      accountId,
      scheduledAt,
      status: "pending",
      payload: JSON.stringify({ itemId: item.id, accountId }),
    });
  }

  await logEvent({
    actor: "user",
    account: account.name,
    action: "schedule.generated",
    outcome: "ok",
    detail: `Zaplanowano ${created} publikacji na koncie „${account.name}"`,
  });

  revalidatePath("/kolejka");
  revalidatePath("/dashboard");
  return { ok: true, data: { created } };
}

function weekdayFromKey(tz: string, dayKey: string): number {
  // Południe wybranego dnia w strefie — bezpieczny punkt do odczytu dnia tygodnia.
  const noon = zonedTimeToUtc(tz, dayKey, 12 * 60);
  return weekdayInZone(tz, noon);
}

const moveSchema = z.object({
  jobId: z.number().int().positive(),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export async function moveJob(input: {
  jobId: number;
  scheduledAt: string;
}): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa data" };

  const [job] = await db.select().from(jobs).where(eq(jobs.id, parsed.data.jobId));
  if (!job) return { ok: false, error: "Zadanie nie istnieje" };
  if (!["pending", "paused", "due"].includes(job.status)) {
    return { ok: false, error: "Można przesuwać tylko zadania oczekujące lub wstrzymane." };
  }

  await db
    .update(jobs)
    .set({ scheduledAt: new Date(parsed.data.scheduledAt).toISOString(), status: "pending" })
    .where(eq(jobs.id, parsed.data.jobId));
  revalidatePath("/kolejka");
  return { ok: true, data: undefined };
}

export async function pauseJob(jobId: number): Promise<ActionResult> {
  await db
    .update(jobs)
    .set({ status: "paused" })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["pending", "due"])));
  revalidatePath("/kolejka");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function resumeJob(jobId: number): Promise<ActionResult> {
  await db
    .update(jobs)
    .set({ status: "pending" })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "paused")));
  revalidatePath("/kolejka");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function cancelJob(jobId: number): Promise<ActionResult> {
  await db
    .update(jobs)
    .set({ status: "cancelled" })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["pending", "paused", "due"])));
  revalidatePath("/kolejka");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

/** Wstrzymuje/wznawia/anuluje wszystkie zadania w widocznym zakresie dat. */
export async function bulkQueueAction(input: {
  action: "pause" | "resume" | "cancel";
  fromIso: string;
  toIso: string;
}): Promise<ActionResult<{ count: number }>> {
  const inRange = and(
    gte(jobs.scheduledAt, input.fromIso),
    lte(jobs.scheduledAt, input.toIso),
  );

  if (input.action === "pause") {
    await db
      .update(jobs)
      .set({ status: "paused" })
      .where(and(inRange, inArray(jobs.status, ["pending", "due"])));
  } else if (input.action === "resume") {
    await db
      .update(jobs)
      .set({ status: "pending" })
      .where(and(inRange, eq(jobs.status, "paused")));
  } else {
    await db
      .update(jobs)
      .set({ status: "cancelled" })
      .where(and(inRange, inArray(jobs.status, ["pending", "paused", "due"])));
  }

  revalidatePath("/kolejka");
  revalidatePath("/dashboard");
  return { ok: true, data: { count: 0 } };
}

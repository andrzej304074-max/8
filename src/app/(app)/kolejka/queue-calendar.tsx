"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { JobStatus } from "@/db/schema";
import { JOB_STATUS_LABELS } from "@/lib/labels";
import {
  bulkQueueAction,
  cancelJob,
  moveJob,
  pauseJob,
  resumeJob,
} from "./actions";

export interface QueueJob {
  id: number;
  dayKey: string;
  timeLabel: string;
  scheduledAtIso: string;
  status: JobStatus;
  itemId: number | null;
  itemName: string;
  accountName: string;
}

export interface CalendarDay {
  dayKey: string;
  label: string;
  isToday: boolean;
  jobs: QueueJob[];
}

const STATUS_STYLES: Record<JobStatus, string> = {
  pending: "border-zinc-300 dark:border-zinc-700",
  paused: "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950",
  due: "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950",
  running: "border-blue-500",
  done: "border-green-400 bg-green-50 opacity-70 dark:border-green-800 dark:bg-green-950",
  failed: "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950",
  cancelled: "border-zinc-200 opacity-50 line-through dark:border-zinc-800",
};

export function QueueCalendar({
  days,
  rangeFromIso,
  rangeToIso,
}: {
  days: CalendarDay[];
  rangeFromIso: string;
  rangeToIso: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragJobId, setDragJobId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
    });
  };

  const dropOnDay = (dayKey: string) => {
    if (dragJobId === null) return;
    const job = days.flatMap((d) => d.jobs).find((j) => j.id === dragJobId);
    setDragJobId(null);
    if (!job || job.dayKey === dayKey) return;
    // Zachowujemy porę dnia, zmieniamy tylko datę.
    const time = job.scheduledAtIso.slice(11);
    const newIso = new Date(`${dayKey}T${time}`).toISOString();
    run(() => moveJob({ jobId: job.id, scheduledAt: newIso }));
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Dla widocznego zakresu:</span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => bulkQueueAction({ action: "pause", fromIso: rangeFromIso, toIso: rangeToIso }))
          }
          className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Wstrzymaj wszystkie
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => bulkQueueAction({ action: "resume", fromIso: rangeFromIso, toIso: rangeToIso }))
          }
          className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Wznów wszystkie
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.dayKey}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropOnDay(day.dayKey)}
            className={`min-h-24 rounded-lg border p-2 ${
              day.isToday
                ? "border-zinc-900 dark:border-zinc-100"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {day.label}
              {day.isToday ? " · dziś" : ""}
            </div>
            <ul className="space-y-1">
              {day.jobs.map((job) => (
                <li
                  key={job.id}
                  draggable={["pending", "paused", "due"].includes(job.status)}
                  onDragStart={() => setDragJobId(job.id)}
                  className={`rounded border p-1.5 text-xs ${STATUS_STYLES[job.status]}`}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="font-medium">{job.timeLabel}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </div>
                  <Link
                    href={job.itemId ? `/magazyn/${job.itemId}` : "#"}
                    className="block truncate hover:underline"
                    title={job.itemName}
                  >
                    {job.itemName}
                  </Link>
                  <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                    {job.accountName}
                  </div>
                  {["pending", "paused", "due"].includes(job.status) ? (
                    <div className="mt-1 flex gap-1 text-[10px]">
                      {job.status === "paused" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => resumeJob(job.id))}
                          className="underline"
                        >
                          Wznów
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => pauseJob(job.id))}
                          className="underline"
                        >
                          Wstrzymaj
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm("Anulować to zaplanowane zadanie?")) {
                            run(() => cancelJob(job.id));
                          }
                        }}
                        className="text-red-600 underline dark:text-red-400"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Przeciągnij zadanie na inny dzień, aby je przesunąć (pora dnia pozostaje bez zmian).
      </p>
    </div>
  );
}

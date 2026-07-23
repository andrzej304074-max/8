"use client";

import { useState, useTransition } from "react";
import type { ScheduleSettings } from "@/lib/schedule-settings";
import { WEEKDAY_LABELS } from "@/lib/labels";
import { saveSchedule } from "./schedule-actions";

const inputCls =
  "rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

export interface ScheduleFormAccount {
  id: number;
  name: string;
  settings: ScheduleSettings | null;
  maxOpsPerHour: number | null;
  maxOpsPerDay: number | null;
}

// Dni tygodnia w kolejności pn…nd (wartości 0-6 wg Date.getDay).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleForm({ account }: { account: ScheduleFormAccount }) {
  const s = account.settings;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await saveSchedule(account.id, formData);
      if (!result.ok) setError(result.error);
      else setNotice("Zapisano harmonogram.");
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h3 className="mb-3 font-medium">{account.name}</h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <span className={labelCls}>Przedmiotów dziennie</span>
          <input
            name="itemsPerDay"
            type="number"
            min={1}
            max={50}
            defaultValue={s?.itemsPerDay ?? 5}
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <span className={labelCls}>Okno od (godz.)</span>
          <input
            name="windowStartHour"
            type="number"
            min={0}
            max={23}
            defaultValue={s?.windowStartHour ?? 8}
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <span className={labelCls}>Okno do (godz.)</span>
          <input
            name="windowEndHour"
            type="number"
            min={1}
            max={24}
            defaultValue={s?.windowEndHour ?? 21}
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <span className={labelCls}>Rozrzut losowy (min)</span>
          <input
            name="jitterMinutes"
            type="number"
            min={0}
            max={180}
            defaultValue={s?.jitterMinutes ?? 20}
            className={`${inputCls} w-full`}
          />
        </div>
      </div>

      <div className="mt-3">
        <span className={labelCls}>Dni tygodnia</span>
        <div className="flex flex-wrap gap-1">
          {DAY_ORDER.map((day) => {
            const checked = s ? s.days.includes(day) : day >= 1 && day <= 5;
            return (
              <label
                key={day}
                className="flex cursor-pointer items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
              >
                <input type="checkbox" name="days" value={day} defaultChecked={checked} />
                {WEEKDAY_LABELS[day]}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <span className={labelCls}>Twardy limit / godz.</span>
          <input
            name="maxOpsPerHour"
            inputMode="numeric"
            placeholder="bez limitu"
            defaultValue={account.maxOpsPerHour ?? ""}
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <span className={labelCls}>Twardy limit / dobę</span>
          <input
            name="maxOpsPerDay"
            inputMode="numeric"
            placeholder="bez limitu"
            defaultValue={account.maxOpsPerDay ?? ""}
            className={`${inputCls} w-full`}
          />
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {notice ? (
        <p className="mt-3 text-sm text-green-700 dark:text-green-400">{notice}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Zapisywanie…" : "Zapisz harmonogram"}
      </button>
    </form>
  );
}

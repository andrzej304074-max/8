"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { executeJob } from "./actions";

export interface TodoJob {
  id: number;
  itemId: number | null;
  itemName: string;
  accountName: string;
  timeLabel: string;
}

export function TodoList({ jobs }: { jobs: TodoJob[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const execute = (jobId: number) => {
    setError(null);
    startTransition(async () => {
      // Akcja przekierowuje na stronę paczki; wraca tylko przy błędzie.
      const result = await executeJob(jobId);
      if (result && !result.ok) setError(result.error);
    });
  };

  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Nic do zrobienia — brak zaległych zadań na dziś.
      </p>
    );
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {jobs.map((job) => (
          <li key={job.id} className="flex flex-wrap items-center gap-2 p-3">
            <span className="w-14 text-sm font-medium">{job.timeLabel}</span>
            <div className="min-w-0 flex-1">
              <Link
                href={job.itemId ? `/magazyn/${job.itemId}` : "#"}
                className="block truncate font-medium hover:underline"
              >
                {job.itemName}
              </Link>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Publikacja · {job.accountName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => execute(job.id)}
              disabled={pending}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {pending ? "…" : "Przygotuj paczkę"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

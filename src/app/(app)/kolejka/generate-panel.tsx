"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generatePublishJobs } from "./actions";

export interface GenerateAccount {
  id: number;
  name: string;
  hasSchedule: boolean;
}

export function GeneratePanel({
  accounts,
  readyCount,
}: {
  accounts: GenerateAccount[];
  readyCount: number;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await generatePublishJobs(accountId);
      if (!result.ok) setError(result.error);
      else setNotice(`Zaplanowano ${result.data.created} publikacji.`);
    });
  };

  const selected = accounts.find((a) => a.id === accountId);

  return (
    <div className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-1 text-sm font-semibold">Zaplanuj publikacje</h2>
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
        Rozłoży w czasie przedmioty w statusie „Gotowy" ({readyCount}) wg
        harmonogramu wybranego konta. Zadania już w kolejce są pomijane.
      </p>
      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Dodaj konto w zakładce{" "}
          <Link href="/konta" className="underline">
            Konta
          </Link>
          , aby planować publikacje.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={accountId}
            onChange={(e) => setAccountId(Number(e.target.value))}
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.hasSchedule ? "" : " (brak harmonogramu)"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generate}
            disabled={pending || !selected?.hasSchedule || readyCount === 0}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Planuję…" : "Zaplanuj"}
          </button>
          {selected && !selected.hasSchedule ? (
            <Link href="/ustawienia" className="text-sm underline">
              Ustaw harmonogram
            </Link>
          ) : null}
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {notice ? (
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">{notice}</p>
      ) : null}
    </div>
  );
}

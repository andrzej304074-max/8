"use client";

import { useState, useTransition } from "react";
import type { AccountAdapter } from "@/db/schema";
import { createAccount, deleteAccount, updateAccount } from "./actions";

export interface AccountRow {
  id: number;
  name: string;
  adapter: AccountAdapter;
  activeListingLimit: number | null;
  publishedCount: number;
}

const inputCls =
  "rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

const ADAPTER_LABELS: Record<AccountAdapter, string> = {
  manual: "Ręczny (paczka do wklejenia)",
  dry_run: "Dry run (tylko logi)",
  vinted: "Vinted automatyczny (Etap 8)",
};

function AccountForm({
  defaults,
  onSubmit,
  submitLabel,
  pending,
}: {
  defaults?: AccountRow;
  onSubmit: (formData: FormData) => void;
  submitLabel: string;
  pending: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        onSubmit(new FormData(form));
        if (!defaults) form.reset();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nazwa konta
        </span>
        <input name="name" required defaultValue={defaults?.name ?? ""} className={inputCls} />
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Tryb publikacji
        </span>
        <select name="adapter" defaultValue={defaults?.adapter ?? "manual"} className={inputCls}>
          <option value="manual">{ADAPTER_LABELS.manual}</option>
          <option value="dry_run">{ADAPTER_LABELS.dry_run}</option>
          <option value="vinted" disabled>
            {ADAPTER_LABELS.vinted}
          </option>
        </select>
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Limit aktywnych ogłoszeń
        </span>
        <input
          name="activeListingLimit"
          inputMode="numeric"
          placeholder="bez limitu"
          defaultValue={defaults?.activeListingLimit ?? ""}
          className={`${inputCls} w-32`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export function AccountsManager({ accounts }: { accounts: AccountRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
      else setEditingId(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Dodaj konto</h2>
        <AccountForm
          onSubmit={(fd) => run(() => createAccount(fd))}
          submitLabel="Dodaj"
          pending={pending}
        />
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Brak kont. Dodaj konto, na którym wystawiasz — będzie potrzebne do
          przygotowania ogłoszenia.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-3 py-2 font-medium">Konto</th>
                <th className="px-3 py-2 font-medium">Tryb publikacji</th>
                <th className="px-3 py-2 font-medium">Aktywne ogłoszenia</th>
                <th className="px-3 py-2 font-medium">Sesja</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-zinc-200 align-top last:border-0 dark:border-zinc-800"
                >
                  {editingId === account.id ? (
                    <td colSpan={5} className="px-3 py-3">
                      <AccountForm
                        defaults={account}
                        onSubmit={(fd) => run(() => updateAccount(account.id, fd))}
                        submitLabel="Zapisz"
                        pending={pending}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium">{account.name}</td>
                      <td className="px-3 py-2">{ADAPTER_LABELS[account.adapter]}</td>
                      <td className="px-3 py-2">
                        {account.publishedCount}
                        {account.activeListingLimit !== null
                          ? ` / ${account.activeListingLimit}`
                          : ""}
                        {account.activeListingLimit !== null &&
                        account.publishedCount >= account.activeListingLimit ? (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            limit osiągnięty
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                        tryb ręczny — bez sesji
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setEditingId(account.id)}
                            className="underline"
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Usunąć konto „${account.name}"? Tej operacji nie można cofnąć.`,
                                )
                              ) {
                                run(() => deleteAccount(account.id));
                              }
                            }}
                            className="text-red-600 underline dark:text-red-400"
                          >
                            Usuń
                          </button>
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

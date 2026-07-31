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
  sessionStatus: "manual" | "active" | "expired";
  hasSession: boolean;
}

const SESSION_BADGE: Record<AccountRow["sessionStatus"], { label: string; cls: string }> = {
  manual: {
    label: "brak sesji",
    cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  active: {
    label: "zalogowane ✓",
    cls: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  expired: {
    label: "sesja wygasła",
    cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
};

const inputCls =
  "rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

const ADAPTER_LABELS: Record<AccountAdapter, string> = {
  manual: "Ręczny (paczka do wklejenia)",
  dry_run: "Dry run (tylko logi)",
  vinted: "Vinted automatyczny (przez przeglądarkę, lokalnie)",
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
          <option value="vinted">{ADAPTER_LABELS.vinted}</option>
        </select>
        <p className="mt-1 max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
          Tryb automatyczny wymaga uruchomienia na Twoim komputerze polecenia{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run publikuj</code>{" "}
          — otworzy przeglądarkę i wypełni formularz Vinted.
        </p>
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

export function AccountsManager({
  accounts,
  remoteBrowserUrl,
}: {
  accounts: AccountRow[];
  remoteBrowserUrl: string | null;
}) {
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

  const hasVintedAccounts = accounts.some((a) => a.adapter === "vinted");

  return (
    <div className="space-y-4">
      {hasVintedAccounts && !remoteBrowserUrl ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="mb-1 font-medium">Logowanie do Vinted nie jest jeszcze podpięte</p>
          <p>
            Masz konta w trybie automatycznym, ale aplikacja nie wie, gdzie stoi
            zdalna przeglądarka. Wdróż usługę na Render (plik{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">render.yaml</code>),
            skopiuj jej adres i dodaj go na Vercelu jako zmienną{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">REMOTE_BROWSER_URL</code>,
            po czym zrób Redeploy. Instrukcja jest w README.
          </p>
        </div>
      ) : null}

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
                <th className="px-3 py-2 font-medium">Logowanie do Vinted</th>
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
                      <td className="px-3 py-2">
                        {account.adapter !== "vinted" ? (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            niepotrzebne w tym trybie
                          </span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`rounded px-2 py-0.5 text-xs font-medium ${SESSION_BADGE[account.sessionStatus].cls}`}
                            >
                              {SESSION_BADGE[account.sessionStatus].label}
                            </span>
                            {remoteBrowserUrl ? (
                              <a
                                href={`${remoteBrowserUrl.replace(/\/$/, "")}/?account=${account.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                              >
                                {account.hasSession
                                  ? "Zaloguj ponownie →"
                                  : "Zaloguj do Vinted →"}
                              </a>
                            ) : (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                ustaw REMOTE_BROWSER_URL
                              </span>
                            )}
                          </div>
                        )}
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

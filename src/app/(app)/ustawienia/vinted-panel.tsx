"use client";

import { useState, useTransition } from "react";
import {
  expireVintedSession,
  removeVintedSession,
  runVintedDiagnostic,
  saveVintedSession,
  type DiagnosticResult,
} from "./vinted-actions";

export interface VintedAccount {
  id: number;
  name: string;
  sessionStatus: "manual" | "active" | "expired";
  hasSession: boolean;
}

const SESSION_LABELS = {
  manual: "brak sesji (tryb ręczny)",
  active: "sesja zapisana",
  expired: "sesja wygasła",
} as const;

export function VintedPanel({ accounts }: { accounts: VintedAccount[] }) {
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<Record<number, DiagnosticResult>>({});
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
    });
  };

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">Integracja Vinted (zaprojektowana, wyłączona)</h2>
      <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <p className="mb-1 font-medium">Automatyczna publikacja jest wyłączona — świadomie.</p>
        <p>
          Konta prywatne + regulamin Vinted (zakaz automatyzacji) = realne ryzyko
          blokady. Pełna warstwa bezpieczeństwa (limiter zapytań, backoff,
          wyłącznik po serii błędów, idempotencja, dziennik) jest gotowa i
          przetestowana, ale transport nic nie wysyła. Realne żądania można
          włączyć wyłącznie dla oficjalnej ścieżki Vinted Pro.
        </p>
      </div>

      {error ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Brak kont. Dodaj konto w zakładce Konta.
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{account.name}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    account.sessionStatus === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : account.sessionStatus === "expired"
                        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                >
                  {SESSION_LABELS[account.sessionStatus]}
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(() => saveVintedSession(account.id, fd));
                  e.currentTarget.reset();
                }}
                className="mb-2 flex flex-wrap items-end gap-2"
              >
                <div className="flex-1">
                  <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Sesja konta (zapisywana wyłącznie zaszyfrowana)
                  </span>
                  <input
                    name="session"
                    type="password"
                    placeholder="wklej token sesji…"
                    className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Zapisz
                </button>
              </form>

              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await runVintedDiagnostic(account.id);
                      if (result.ok) setDiag((d) => ({ ...d, [account.id]: result.data }));
                      return result;
                    })
                  }
                  className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Diagnostyka na sucho
                </button>
                {account.hasSession ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removeVintedSession(account.id))}
                    className="underline"
                  >
                    Usuń sesję
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await expireVintedSession(account.id);
                      return result;
                    })
                  }
                  className="text-zinc-500 underline dark:text-zinc-400"
                  title="Symuluje wygaśnięcie sesji: wstrzymuje kolejkę tego konta"
                >
                  Symuluj wygaśnięcie sesji
                </button>
              </div>

              {diag[account.id] ? (
                <div className="mt-2 rounded border border-blue-300 bg-blue-50 p-2 text-xs dark:border-blue-900 dark:bg-blue-950">
                  <p>
                    <strong>Wynik:</strong> {diag[account.id]?.outcome}
                  </p>
                  <p>
                    <strong>Wyłącznik:</strong>{" "}
                    {diag[account.id]?.breakerState === "closed" ? "zamknięty (OK)" : "otwarty"}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">{diag[account.id]?.note}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import {
  deleteListing,
  markListingPublished,
  runDryRunPublish,
} from "../actions";

export function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-xs font-semibold">{label}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {copied ? "Skopiowano ✓" : "Kopiuj"}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-2 text-sm">
        {value || "—"}
      </pre>
    </div>
  );
}

export function PackageActions({
  listingId,
  status,
  isDryRun,
}: {
  listingId: number;
  status: string;
  isDryRun: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok && result.error) setError(result.error);
      else if (done) setNotice(done);
    });
  };

  if (status !== "draft") {
    return null;
  }

  return (
    <div className="space-y-3">
      {isDryRun ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => runDryRunPublish(listingId),
                "Dry run wykonany — pełny payload znajdziesz w Historii.",
              )
            }
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Wykonuję…" : "Symuluj publikację (dry run)"}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Niczego nie wysyła — loguje payload do Historii.
          </span>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            run(() => markListingPublished(listingId, formData));
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Adres URL ogłoszenia na Vinted (opcjonalnie)
            </span>
            <input
              name="externalRef"
              placeholder="https://www.vinted.pl/items/…"
              className="w-72 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
          >
            {pending ? "Zapisuję…" : "Wkleiłem — oznacz jako opublikowane"}
          </button>
        </form>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Usunąć ten szkic ogłoszenia? Tej operacji nie można cofnąć.")) {
            run(() => deleteListing(listingId));
          }
        }}
        className="text-sm text-red-600 underline dark:text-red-400"
      >
        Usuń szkic
      </button>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 dark:text-green-400">{notice}</p> : null}
    </div>
  );
}

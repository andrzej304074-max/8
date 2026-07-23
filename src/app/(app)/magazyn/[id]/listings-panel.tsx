"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createListing } from "@/app/(app)/ogloszenia/actions";
import type { AccountAdapter, ListingStatus } from "@/db/schema";
import { formatPln } from "@/domain/finance/money";
import { LISTING_STATUS_LABELS } from "@/lib/labels";

export interface ListingSummary {
  id: number;
  accountName: string;
  status: ListingStatus;
  priceGr: number | null;
  publishedAt: string | null;
}

export interface AccountOption {
  id: number;
  name: string;
  adapter: AccountAdapter;
}

export function ListingsPanel({
  itemId,
  listings,
  accounts,
}: {
  itemId: number;
  listings: ListingSummary[];
  accounts: AccountOption[];
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const prepare = () => {
    setError(null);
    startTransition(async () => {
      // Akcja przekierowuje na stronę paczki; wraca tylko przy błędzie.
      const result = await createListing(itemId, accountId);
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-2 text-sm font-semibold">Ogłoszenia</h2>

      {listings.length > 0 ? (
        <ul className="mb-3 space-y-1 text-sm">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-baseline gap-2">
              <Link href={`/ogloszenia/${listing.id}`} className="font-medium hover:underline">
                #{listing.id} · {listing.accountName}
              </Link>
              <span className="text-zinc-500 dark:text-zinc-400">
                {LISTING_STATUS_LABELS[listing.status]}
                {listing.priceGr !== null ? ` · ${formatPln(listing.priceGr)}` : ""}
                {listing.publishedAt
                  ? ` · od ${listing.publishedAt.slice(0, 10)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Ten przedmiot nie ma jeszcze ogłoszeń.
        </p>
      )}

      {accounts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Aby przygotować ogłoszenie,{" "}
          <Link href="/konta" className="underline">
            dodaj najpierw konto
          </Link>
          .
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
                {account.adapter === "dry_run" ? " (dry run)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={prepare}
            disabled={pending || accountId === 0}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Przygotowuję…" : "Przygotuj ogłoszenie"}
          </button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}

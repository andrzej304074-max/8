"use client";

import { useState, useTransition } from "react";
import { groszeToInputValue } from "@/domain/finance/money";
import { markListingSold } from "../actions";

const inputCls =
  "rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

export function SoldForm({
  listingId,
  suggestedPriceGr,
}: {
  listingId: number;
  suggestedPriceGr: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await markListingSold(listingId, formData);
      if (!result.ok) setError(result.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
      >
        Oznacz jako sprzedane
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
    >
      <h3 className="mb-3 text-sm font-semibold">Zapisz sprzedaż</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <span className="mb-1 block text-xs font-medium">Cena finalna (zł)</span>
          <input
            name="finalPrice"
            inputMode="decimal"
            required
            defaultValue={suggestedPriceGr !== null ? groszeToInputValue(suggestedPriceGr) : ""}
            className={`${inputCls} w-full`}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium">Prowizja (zł)</span>
          <input name="commission" inputMode="decimal" placeholder="0,00" className={`${inputCls} w-full`} />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium">Koszt wysyłki (zł)</span>
          <input name="shipping" inputMode="decimal" placeholder="0,00" className={`${inputCls} w-full`} />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium">Data sprzedaży</span>
          <input name="soldAt" type="date" className={`${inputCls} w-full`} />
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        Marża zostanie wyliczona automatycznie: cena finalna − prowizja − wysyłka − cena zakupu.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Zapisz sprzedaż"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ItemStatus } from "@/db/schema";
import { ITEM_STATUSES } from "@/db/schema";
import { formatPln } from "@/domain/finance/money";
import { STATUS_LABELS } from "@/lib/labels";
import { bulkUpdateItems } from "./actions";

export interface ItemRow {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  condition: string | null;
  expectedPriceGr: number | null;
  status: ItemStatus;
  location: string | null;
  days: number;
  photoUrl: string | null;
}

export function ItemsTable({ items }: { items: ItemRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSelected = items.length > 0 && selected.size === items.length;

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulk = () => {
    setError(null);
    if (!bulkStatus && bulkLocation.trim() === "") {
      setError("Wybierz status lub wpisz lokalizację.");
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdateItems({
        ids: [...selected],
        ...(bulkStatus ? { status: bulkStatus as ItemStatus } : {}),
        ...(bulkLocation.trim() !== "" ? { location: bulkLocation.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setBulkStatus("");
      setBulkLocation("");
      router.refresh();
    });
  };

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="font-medium">Zaznaczono: {selected.size}</span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Status: bez zmiany</option>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            value={bulkLocation}
            onChange={(e) => setBulkLocation(e.target.value)}
            placeholder="Lokalizacja: bez zmiany"
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            onClick={applyBulk}
            disabled={pending}
            className="rounded bg-zinc-900 px-3 py-1 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "Zapisywanie…" : "Zastosuj"}
          </button>
          <button onClick={() => setSelected(new Set())} className="underline">
            Odznacz
          </button>
          {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Zaznacz wszystkie"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
                  }
                />
              </th>
              <th className="px-3 py-2 font-medium">Zdjęcie</th>
              <th className="px-3 py-2 font-medium">Nazwa</th>
              <th className="px-3 py-2 font-medium">Marka</th>
              <th className="px-3 py-2 font-medium">Kategoria</th>
              <th className="px-3 py-2 font-medium">Rozmiar</th>
              <th className="px-3 py-2 font-medium">Stan</th>
              <th className="px-3 py-2 font-medium">Cena</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Dni</th>
              <th className="px-3 py-2 font-medium">Lokalizacja</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-zinc-200 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Zaznacz ${item.name}`}
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  {item.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <span className="inline-block h-10 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/magazyn/${item.id}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{item.brand ?? "—"}</td>
                <td className="px-3 py-2">{item.category ?? "—"}</td>
                <td className="px-3 py-2">{item.size ?? "—"}</td>
                <td className="px-3 py-2">{item.condition ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {item.expectedPriceGr !== null ? formatPln(item.expectedPriceGr) : "—"}
                </td>
                <td className="px-3 py-2">{STATUS_LABELS[item.status]}</td>
                <td className="px-3 py-2">{item.days}</td>
                <td className="px-3 py-2">{item.location ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

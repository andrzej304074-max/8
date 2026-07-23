"use client";

import { usePathname, useRouter } from "next/navigation";
import { ITEM_STATUSES } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/labels";

const selectCls =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export interface FilterValues {
  status?: string;
  marka?: string;
  kategoria?: string;
  rozmiar?: string;
  wiek?: string;
  widok?: string;
}

export function Filters({
  current,
  brands,
  categories,
  sizes,
}: {
  current: FilterValues;
  brands: string[];
  categories: string[];
  sizes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const setFilter = (key: keyof FilterValues, value: string) => {
    const params = new URLSearchParams();
    const next: FilterValues = { ...current, [key]: value || undefined };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Status"
        value={current.status ?? ""}
        onChange={(e) => setFilter("status", e.target.value)}
        className={selectCls}
      >
        <option value="">Status: wszystkie</option>
        {ITEM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      <select
        aria-label="Marka"
        value={current.marka ?? ""}
        onChange={(e) => setFilter("marka", e.target.value)}
        className={selectCls}
      >
        <option value="">Marka: wszystkie</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <select
        aria-label="Kategoria"
        value={current.kategoria ?? ""}
        onChange={(e) => setFilter("kategoria", e.target.value)}
        className={selectCls}
      >
        <option value="">Kategoria: wszystkie</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label="Rozmiar"
        value={current.rozmiar ?? ""}
        onChange={(e) => setFilter("rozmiar", e.target.value)}
        className={selectCls}
      >
        <option value="">Rozmiar: wszystkie</option>
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Wiek w magazynie"
        value={current.wiek ?? ""}
        onChange={(e) => setFilter("wiek", e.target.value)}
        className={selectCls}
      >
        <option value="">Wiek: dowolny</option>
        <option value="7">ponad 7 dni</option>
        <option value="30">ponad 30 dni</option>
        <option value="60">ponad 60 dni</option>
        <option value="90">ponad 90 dni</option>
      </select>
    </div>
  );
}

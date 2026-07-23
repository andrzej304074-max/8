"use client";

import { usePathname, useRouter } from "next/navigation";

const selectCls =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export interface HistoryFilterValues {
  akcja?: string;
  konto?: string;
  wynik?: string;
}

export function HistoryFilters({
  current,
  actions,
  accounts,
}: {
  current: HistoryFilterValues;
  actions: string[];
  accounts: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const setFilter = (key: keyof HistoryFilterValues, value: string) => {
    const next: HistoryFilterValues = { ...current, [key]: value || undefined };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Akcja"
        value={current.akcja ?? ""}
        onChange={(e) => setFilter("akcja", e.target.value)}
        className={selectCls}
      >
        <option value="">Akcja: wszystkie</option>
        {actions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>

      <select
        aria-label="Konto"
        value={current.konto ?? ""}
        onChange={(e) => setFilter("konto", e.target.value)}
        className={selectCls}
      >
        <option value="">Konto: wszystkie</option>
        {accounts.map((account) => (
          <option key={account} value={account}>
            {account}
          </option>
        ))}
      </select>

      <select
        aria-label="Wynik"
        value={current.wynik ?? ""}
        onChange={(e) => setFilter("wynik", e.target.value)}
        className={selectCls}
      >
        <option value="">Wynik: wszystkie</option>
        <option value="ok">OK</option>
        <option value="error">Błąd</option>
      </select>
    </div>
  );
}

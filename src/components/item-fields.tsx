"use client";

import type { items } from "@/db/schema";
import { ITEM_STATUSES } from "@/db/schema";
import { groszeToInputValue } from "@/domain/finance/money";
import { CONDITIONS, STATUS_LABELS } from "@/lib/labels";

type Item = typeof items.$inferSelect;

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

/** Pola formularza przedmiotu — wspólne dla kreatora dodawania i edycji. */
export function ItemFields({
  defaults,
  showStatus = false,
}: {
  defaults?: Partial<Item>;
  showStatus?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Nazwa robocza *">
          <input name="name" required defaultValue={defaults?.name ?? ""} className={inputCls} />
        </Field>
      </div>

      <Field label="Marka">
        <input name="brand" defaultValue={defaults?.brand ?? ""} className={inputCls} />
      </Field>
      <Field label="Kategoria">
        <input
          name="category"
          placeholder="np. Kobiety / Odzież / Swetry"
          defaultValue={defaults?.category ?? ""}
          className={inputCls}
        />
      </Field>

      <Field label="Rozmiar">
        <input name="size" defaultValue={defaults?.size ?? ""} className={inputCls} />
      </Field>
      <Field label="Stan">
        <select name="condition" defaultValue={defaults?.condition ?? ""} className={inputCls}>
          <option value="">— wybierz —</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Kolor">
        <input name="color" defaultValue={defaults?.color ?? ""} className={inputCls} />
      </Field>
      <Field label="Materiał">
        <input name="material" defaultValue={defaults?.material ?? ""} className={inputCls} />
      </Field>

      <Field label="Cena zakupu (zł)">
        <input
          name="purchasePriceGr"
          inputMode="decimal"
          placeholder="np. 15,00"
          defaultValue={groszeToInputValue(defaults?.purchasePriceGr ?? null)}
          className={inputCls}
        />
      </Field>
      <Field label="Oczekiwana cena sprzedaży (zł)">
        <input
          name="expectedPriceGr"
          inputMode="decimal"
          placeholder="np. 45,00"
          defaultValue={groszeToInputValue(defaults?.expectedPriceGr ?? null)}
          className={inputCls}
        />
      </Field>

      <Field label="Koszt wysyłki (zł)">
        <input
          name="shippingCostGr"
          inputMode="decimal"
          defaultValue={groszeToInputValue(defaults?.shippingCostGr ?? null)}
          className={inputCls}
        />
      </Field>
      <Field label="Lokalizacja fizyczna">
        <input
          name="location"
          placeholder="np. pudło A3"
          defaultValue={defaults?.location ?? ""}
          className={inputCls}
        />
      </Field>

      {showStatus ? (
        <Field label="Status">
          <select name="status" defaultValue={defaults?.status ?? "draft"} className={inputCls}>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="sm:col-span-2">
        <Field label="Notatki wewnętrzne">
          <textarea name="notes" rows={3} defaultValue={defaults?.notes ?? ""} className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

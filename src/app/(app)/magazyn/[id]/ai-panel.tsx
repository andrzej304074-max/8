"use client";

import { useState, useTransition } from "react";
import type { AiSuggestionRecord } from "@/ai/schema";
import { CONDITIONS } from "@/lib/labels";
import {
  applyAiSuggestion,
  discardAiSuggestion,
  generateAiSuggestion,
} from "./ai-actions";

const inputCls =
  "w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

const CONFIDENCE_LABELS = {
  high: "wysoka",
  medium: "średnia",
  low: "niska",
} as const;

export function AiPanel({
  itemId,
  record,
}: {
  itemId: number;
  record: AiSuggestionRecord | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [titleLength, setTitleLength] = useState(record?.data.title.length ?? 0);
  const [pending, startTransition] = useTransition();

  const generate = (force: boolean) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await generateAiSuggestion(itemId, { force });
      if (!result.ok) setError(result.error);
    });
  };

  if (!record) {
    return (
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold">Ogłoszenie z AI</h2>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Model wizyjny (Gemini) przeanalizuje zdjęcia i zaproponuje tytuł, opis,
          markę, kategorię, stan i cenę. Nic nie zostanie zapisane bez Twojej
          akceptacji.
        </p>
        <button
          type="button"
          onClick={() => generate(false)}
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Analizuję zdjęcia… (do minuty)" : "Generuj opis z AI"}
        </button>
        {error ? (
          <p className="mt-3 whitespace-pre-line text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const { data } = record;
  const lowBrand = data.brand_confidence === "low";

  function handleApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await applyAiSuggestion(itemId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice("Zastosowano — pola przedmiotu zostały zaktualizowane.");
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">Ogłoszenie z AI</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {record.fromCache ? "wynik z cache (bez kosztu)" : "świeżo wygenerowane"}
          {record.appliedAt ? " · zastosowane ✓" : " · czeka na Twoją akceptację"}
        </span>
      </div>

      {data.flags.length > 0 ? (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="mb-1 font-semibold">
            Wykryte wady / problemy — ukrycie wady to prosta droga do reklamacji:
          </p>
          <ul className="list-inside list-disc">
            {data.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.measurements_needed.length > 0 ? (
        <div className="mb-3 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          <span className="font-semibold">Zmierz i dopisz do opisu:</span>{" "}
          {data.measurements_needed.join(", ")}
        </div>
      ) : null}

      <form onSubmit={handleApply} className="space-y-3">
        <div>
          <span className={labelCls}>
            Tytuł ({titleLength}/60)
          </span>
          <input
            name="title"
            defaultValue={data.title}
            maxLength={60}
            required
            onChange={(e) => setTitleLength(e.target.value.length)}
            className={inputCls}
          />
        </div>

        <div>
          <span className={labelCls}>Opis</span>
          <textarea
            name="description"
            defaultValue={data.description}
            rows={5}
            required
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className={labelCls}>
              Marka · pewność AI: {CONFIDENCE_LABELS[data.brand_confidence]}
            </span>
            <input
              name="brand"
              defaultValue={data.brand ?? ""}
              className={
                lowBrand
                  ? `${inputCls} border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950`
                  : inputCls
              }
            />
            {lowBrand ? (
              <label className="mt-1 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <input type="checkbox" name="brandConfirmed" />
                Potwierdzam markę — AI nie było jej pewne
              </label>
            ) : null}
          </div>

          <div>
            <span className={labelCls}>Kategoria</span>
            <input
              name="category"
              defaultValue={data.category_path.join(" / ")}
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Rozmiar</span>
            <input name="size" defaultValue={data.size ?? ""} className={inputCls} />
          </div>

          <div>
            <span className={labelCls}>Stan</span>
            <select name="condition" defaultValue={data.condition} className={inputCls}>
              <option value="">— wybierz —</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelCls}>Kolor</span>
            <input
              name="color"
              defaultValue={data.color.join(", ")}
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Materiał</span>
            <input
              name="material"
              defaultValue={data.material ?? ""}
              className={inputCls}
            />
          </div>

          <div>
            <span className={labelCls}>Cena (zł)</span>
            <input
              name="price"
              inputMode="decimal"
              defaultValue={String(data.suggested_price_pln).replace(".", ",")}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {data.price_reasoning}
            </p>
          </div>
        </div>

        {error ? (
          <p className="whitespace-pre-line text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {notice ? (
          <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? "Pracuję…" : "Zastosuj do przedmiotu"}
          </button>
          <button
            type="button"
            onClick={() => generate(true)}
            disabled={pending}
            className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            title="Pomija cache i pyta model ponownie"
          >
            Generuj ponownie
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Odrzucić sugestię AI? Pola przedmiotu nie zostaną zmienione.")) {
                startTransition(async () => {
                  const result = await discardAiSuggestion(itemId);
                  if (!result.ok) setError(result.error);
                });
              }
            }}
            disabled={pending}
            className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Odrzuć
          </button>
        </div>
      </form>
    </section>
  );
}

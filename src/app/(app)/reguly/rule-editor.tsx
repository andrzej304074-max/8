"use client";

import { useState, useTransition } from "react";
import {
  ACTION_LABELS,
  FIELD_LABELS,
  OPERATOR_LABELS,
  TEXT_FIELDS,
} from "@/domain/rules/labels";
import {
  RULE_FIELDS,
  RULE_OPERATORS,
  type RuleAction,
  type RuleClause,
  type RuleConditions,
  type RuleField,
} from "@/domain/rules/types";
import { parsePlnToGrosze, groszeToInputValue } from "@/domain/finance/money";
import { createRule, updateRule } from "./actions";

const inputCls =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

export interface RuleDraft {
  id?: number;
  name: string;
  conditions: RuleConditions;
  action: RuleAction;
  maxExecutions: number | null;
  enabled: boolean;
}

const EMPTY_DRAFT: RuleDraft = {
  name: "",
  conditions: { match: "all", clauses: [{ field: "days_listed", op: "gt", value: 7 }] },
  action: { type: "price_drop", percent: 10, min_price_gr: 2000, max_per_item: 3 },
  maxExecutions: null,
  enabled: true,
};

export function RuleEditor({
  initial,
  onDone,
}: {
  initial?: RuleDraft;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(initial ?? EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setClause = (idx: number, patch: Partial<RuleClause>) => {
    setDraft((d) => {
      const clauses = d.conditions.clauses.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        // Zmiana na pole tekstowe wymusza operator eq i wartość tekstową.
        if (TEXT_FIELDS.includes(next.field) && !["eq", "neq"].includes(next.op)) {
          next.op = "eq";
        }
        return next;
      });
      return { ...d, conditions: { ...d.conditions, clauses } };
    });
  };

  const addClause = () =>
    setDraft((d) => ({
      ...d,
      conditions: {
        ...d.conditions,
        clauses: [...d.conditions.clauses, { field: "views", op: "lt", value: 5 }],
      },
    }));

  const removeClause = (idx: number) =>
    setDraft((d) => ({
      ...d,
      conditions: {
        ...d.conditions,
        clauses: d.conditions.clauses.filter((_, i) => i !== idx),
      },
    }));

  const clauseValue = (clause: RuleClause): string =>
    typeof clause.value === "number" ? String(clause.value) : clause.value;

  const setValue = (idx: number, raw: string, field: RuleField) => {
    const value = TEXT_FIELDS.includes(field) ? raw : Number(raw);
    setClause(idx, { value });
  };

  function save() {
    setError(null);
    startTransition(async () => {
      const payload = {
        name: draft.name,
        conditions: draft.conditions,
        action: draft.action,
        maxExecutions: draft.maxExecutions,
        enabled: draft.enabled,
      };
      const result = draft.id
        ? await updateRule(draft.id, payload)
        : await createRule(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  const action = draft.action;

  return (
    <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="mb-3">
        <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Nazwa reguły
        </span>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="np. Obniżka po 21 dniach"
          className={`${inputCls} w-full`}
        />
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center gap-2 text-sm">
          <span className="font-medium">Jeśli</span>
          <select
            value={draft.conditions.match}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                conditions: { ...d.conditions, match: e.target.value as "all" | "any" },
              }))
            }
            className={inputCls}
          >
            <option value="all">wszystkie warunki</option>
            <option value="any">dowolny warunek</option>
          </select>
          <span className="font-medium">są spełnione:</span>
        </div>

        <div className="space-y-2">
          {draft.conditions.clauses.map((clause, idx) => {
            const isText = TEXT_FIELDS.includes(clause.field);
            return (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <select
                  value={clause.field}
                  onChange={(e) => setClause(idx, { field: e.target.value as RuleField })}
                  className={inputCls}
                >
                  {RULE_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
                <select
                  value={clause.op}
                  onChange={(e) => setClause(idx, { op: e.target.value as RuleClause["op"] })}
                  className={inputCls}
                >
                  {RULE_OPERATORS.filter((op) => !isText || ["eq", "neq"].includes(op)).map(
                    (op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </option>
                    ),
                  )}
                </select>
                <input
                  value={clauseValue(clause)}
                  onChange={(e) => setValue(idx, e.target.value, clause.field)}
                  placeholder={isText ? "np. published" : "liczba"}
                  className={`${inputCls} w-28`}
                />
                {draft.conditions.clauses.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeClause(idx)}
                    className="text-sm text-red-600 dark:text-red-400"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addClause}
          className="mt-2 text-sm underline"
        >
          + dodaj warunek
        </button>
      </div>

      <div className="mb-3">
        <span className="mb-1 block text-sm font-medium">To wykonaj akcję:</span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={action.type}
            onChange={(e) => {
              const type = e.target.value as RuleAction["type"];
              setDraft((d) => ({
                ...d,
                action:
                  type === "price_drop"
                    ? { type, percent: 10, min_price_gr: 2000, max_per_item: 3 }
                    : { type },
              }));
            }}
            className={inputCls}
          >
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {action.type === "price_drop" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>o</span>
              <input
                type="number"
                min={1}
                max={90}
                value={action.percent}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    action: { ...action, percent: Number(e.target.value) },
                  }))
                }
                className={`${inputCls} w-16`}
              />
              <span>%, nie poniżej</span>
              <input
                inputMode="decimal"
                defaultValue={groszeToInputValue(action.min_price_gr)}
                onChange={(e) => {
                  const gr = parsePlnToGrosze(e.target.value);
                  if (gr !== null) {
                    setDraft((d) => ({ ...d, action: { ...action, min_price_gr: gr } }));
                  }
                }}
                className={`${inputCls} w-20`}
              />
              <span>zł, maks.</span>
              <input
                type="number"
                min={1}
                max={20}
                value={action.max_per_item}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    action: { ...action, max_per_item: Number(e.target.value) },
                  }))
                }
                className={`${inputCls} w-16`}
              />
              <span>razy na przedmiot</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span>Limit wykonań reguły:</span>
          <input
            inputMode="numeric"
            placeholder="bez limitu"
            value={draft.maxExecutions ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              setDraft((d) => ({
                ...d,
                maxExecutions: v === "" ? null : Math.max(0, Number(v) || 0),
              }));
            }}
            className={`${inputCls} w-28`}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          <span>Reguła włączona</span>
        </label>
      </div>

      {error ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Zapisywanie…" : draft.id ? "Zapisz zmiany" : "Utwórz regułę"}
        </button>
        <button type="button" onClick={onDone} className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          Anuluj
        </button>
      </div>
    </div>
  );
}

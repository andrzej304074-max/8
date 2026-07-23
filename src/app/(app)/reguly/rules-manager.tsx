"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatPln } from "@/domain/finance/money";
import type { RuleAction, RuleConditions } from "@/domain/rules/types";
import type { DryRunResult } from "@/lib/rules-service";
import { deleteRule, previewRule, runRule, toggleRule } from "./actions";
import { RuleEditor, type RuleDraft } from "./rule-editor";
import { RuleSummary } from "./rule-summary";

export interface RuleRow {
  id: number;
  name: string;
  conditions: RuleConditions;
  action: RuleAction;
  maxExecutions: number | null;
  executionsCount: number;
  enabled: boolean;
}

export function RulesManager({ rules }: { rules: RuleRow[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ ruleId: number; data: DryRunResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const doPreview = (ruleId: number) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await previewRule(ruleId);
      if (!result.ok) setError(result.error);
      else setPreview({ ruleId, data: result.data });
    });
  };

  const doApply = (ruleId: number, actionableCount: number) => {
    if (
      !window.confirm(
        `Wykonać regułę na ${actionableCount} przedmiotach? Zmiany cen/statusów zostaną zapisane i trafią do Historii.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runRule(ruleId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(null);
      setNotice(
        `Wykonano regułę: zastosowano do ${result.data.applied} przedmiotów` +
          (result.data.skippedByLimit > 0
            ? `, pominięto ${result.data.skippedByLimit} (limit reguły).`
            : "."),
      );
    });
  };

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 dark:text-green-400">{notice}</p> : null}

      {creating ? (
        <RuleEditor onDone={() => setCreating(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + Nowa reguła
        </button>
      )}

      {rules.length === 0 && !creating ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Brak reguł. Utwórz pierwszą — np. „po 21 dniach obniż cenę o 10%, maks. 3 razy".
        </p>
      ) : null}

      <ul className="space-y-3">
        {rules.map((rule) => {
          const draft: RuleDraft = {
            id: rule.id,
            name: rule.name,
            conditions: rule.conditions,
            action: rule.action,
            maxExecutions: rule.maxExecutions,
            enabled: rule.enabled,
          };
          if (editingId === rule.id) {
            return (
              <li key={rule.id}>
                <RuleEditor initial={draft} onDone={() => setEditingId(null)} />
              </li>
            );
          }
          return (
            <li
              key={rule.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="font-medium">{rule.name}</span>
                  {!rule.enabled ? (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                      wyłączona
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  wykonań: {rule.executionsCount}
                  {rule.maxExecutions !== null ? ` / ${rule.maxExecutions}` : ""}
                </span>
              </div>

              <RuleSummary conditions={rule.conditions} action={rule.action} />

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => doPreview(rule.id)}
                  className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Podgląd na sucho
                </button>
                <button type="button" onClick={() => setEditingId(rule.id)} className="underline">
                  Edytuj
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleRule(rule.id, !rule.enabled);
                    })
                  }
                  className="underline"
                >
                  {rule.enabled ? "Wyłącz" : "Włącz"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Usunąć regułę „${rule.name}"?`)) {
                      startTransition(async () => {
                        await deleteRule(rule.id);
                      });
                    }
                  }}
                  className="text-red-600 underline dark:text-red-400"
                >
                  Usuń
                </button>
              </div>

              {preview?.ruleId === rule.id ? (
                <PreviewPanel
                  data={preview.data}
                  pending={pending}
                  onApply={() => doApply(rule.id, preview.data.actionable.length)}
                  onClose={() => setPreview(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PreviewPanel({
  data,
  pending,
  onApply,
  onClose,
}: {
  data: DryRunResult;
  pending: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 rounded border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-semibold text-blue-900 dark:text-blue-200">
          Podgląd na sucho: reguła dotknęłaby dziś {data.actionable.length}{" "}
          {data.actionable.length === 1 ? "przedmiotu" : "przedmiotów"}
          {data.remainingExecutions !== null
            ? ` (limit reguły: pozostało ${data.remainingExecutions})`
            : ""}
        </span>
        <button type="button" onClick={onClose} className="text-xs underline">
          zamknij
        </button>
      </div>

      {data.actionable.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Żaden przedmiot nie spełnia warunków z możliwym efektem.
        </p>
      ) : (
        <ul className="mb-2 divide-y divide-blue-200 dark:divide-blue-900">
          {data.actionable.map((c) => (
            <li key={c.listingId} className="flex flex-wrap items-baseline justify-between gap-2 py-1">
              <Link href={`/magazyn/${c.itemId}`} className="font-medium hover:underline">
                {c.itemName}
              </Link>
              <span className="text-zinc-600 dark:text-zinc-400">
                {c.daysListed} dni ·{" "}
                {c.effect?.type === "price_drop"
                  ? `${formatPln(c.effect.oldPriceGr)} → ${formatPln(c.effect.newPriceGr)}`
                  : c.effect?.type === "relist"
                    ? "ponowne wystawienie"
                    : "odświeżenie"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data.blocked.length > 0 ? (
        <details className="mb-2">
          <summary className="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">
            Pasujące, ale pominięte: {data.blocked.length}
          </summary>
          <ul className="mt-1">
            {data.blocked.map((c) => (
              <li key={c.listingId} className="text-xs text-zinc-500 dark:text-zinc-400">
                {c.itemName} — {c.blockedReason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {data.actionable.length > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={onApply}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {pending ? "Wykonuję…" : `Wykonaj regułę na ${data.actionable.length} przedmiotach`}
        </button>
      ) : null}
    </div>
  );
}

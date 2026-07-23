import { groszeToInputValue } from "@/domain/finance/money";
import {
  ACTION_LABELS,
  FIELD_LABELS,
  OPERATOR_LABELS,
} from "@/domain/rules/labels";
import type { RuleAction, RuleConditions } from "@/domain/rules/types";

/** Czytelne, jednozdaniowe streszczenie reguły. */
export function RuleSummary({
  conditions,
  action,
}: {
  conditions: RuleConditions;
  action: RuleAction;
}) {
  const joiner = conditions.match === "all" ? " oraz " : " lub ";
  const conditionText = conditions.clauses
    .map(
      (c) =>
        `${FIELD_LABELS[c.field]} ${OPERATOR_LABELS[c.op]} ${
          typeof c.value === "number" ? c.value : `„${c.value}"`
        }`,
    )
    .join(joiner);

  let actionText: string = ACTION_LABELS[action.type];
  if (action.type === "price_drop") {
    actionText = `obniż cenę o ${action.percent}%, nie poniżej ${groszeToInputValue(
      action.min_price_gr,
    )} zł, maks. ${action.max_per_item}× na przedmiot`;
  }

  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      <span className="font-medium text-zinc-800 dark:text-zinc-200">Jeśli</span>{" "}
      {conditionText}, <span className="font-medium text-zinc-800 dark:text-zinc-200">to</span>{" "}
      {actionText}.
    </p>
  );
}

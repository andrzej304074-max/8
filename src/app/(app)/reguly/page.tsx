import { desc } from "drizzle-orm";
import { db } from "@/db";
import { rules } from "@/db/schema";
import { actionSchema, conditionsSchema } from "@/domain/rules/types";
import { RulesManager, type RuleRow } from "./rules-manager";

export const dynamic = "force-dynamic";

export default async function RegulyPage() {
  const ruleRows = await db.select().from(rules).orderBy(desc(rules.createdAt));

  // Pomijamy reguły z uszkodzonym JSON (nie powinno się zdarzyć — walidacja przy zapisie).
  const parsed: RuleRow[] = [];
  for (const rule of ruleRows) {
    const conditions = conditionsSchema.safeParse(JSON.parse(rule.conditions));
    const action = actionSchema.safeParse(JSON.parse(rule.actions));
    if (!conditions.success || !action.success) continue;
    parsed.push({
      id: rule.id,
      name: rule.name,
      conditions: conditions.data,
      action: action.data,
      maxExecutions: rule.maxExecutions,
      executionsCount: rule.executionsCount,
      enabled: rule.enabled,
    });
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Reguły relistingu</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Reguły są danymi w bazie, nie kodem: definiujesz warunki i akcję. Zanim
        cokolwiek się wykona, użyj <strong>podglądu na sucho</strong> — pokaże
        dokładnie, które przedmioty reguła dotknie i jaki będzie efekt. Zmiany
        cen zapisują się lokalnie i w Historii; pamiętaj zaktualizować je też na
        platformie.
      </p>
      <RulesManager rules={parsed} />
    </div>
  );
}

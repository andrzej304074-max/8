"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { rules } from "@/db/schema";
import { actionSchema, conditionsSchema } from "@/domain/rules/types";
import { applyRule, dryRunRule, type DryRunResult } from "@/lib/rules-service";

interface RuleInput {
  name: string;
  conditions: unknown;
  action: unknown;
  maxExecutions: number | null;
  enabled: boolean;
}

function validate(input: RuleInput):
  | { ok: true; conditions: string; actions: string }
  | { ok: false; error: string } {
  if (input.name.trim() === "") return { ok: false, error: "Nazwa reguły jest wymagana" };
  const conditions = conditionsSchema.safeParse(input.conditions);
  if (!conditions.success) {
    return { ok: false, error: `Warunki: ${conditions.error.issues[0]?.message}` };
  }
  const action = actionSchema.safeParse(input.action);
  if (!action.success) {
    return { ok: false, error: `Akcja: ${action.error.issues[0]?.message}` };
  }
  return {
    ok: true,
    conditions: JSON.stringify(conditions.data),
    actions: JSON.stringify(action.data),
  };
}

export async function createRule(input: RuleInput): Promise<ActionResult<{ id: number }>> {
  const validated = validate(input);
  if (!validated.ok) return validated;
  const [created] = await db
    .insert(rules)
    .values({
      name: input.name.trim(),
      conditions: validated.conditions,
      actions: validated.actions,
      maxExecutions: input.maxExecutions,
      enabled: input.enabled,
    })
    .returning({ id: rules.id });
  revalidatePath("/reguly");
  return created
    ? { ok: true, data: { id: created.id } }
    : { ok: false, error: "Nie udało się zapisać reguły" };
}

export async function updateRule(ruleId: number, input: RuleInput): Promise<ActionResult> {
  const validated = validate(input);
  if (!validated.ok) return validated;
  await db
    .update(rules)
    .set({
      name: input.name.trim(),
      conditions: validated.conditions,
      actions: validated.actions,
      maxExecutions: input.maxExecutions,
      enabled: input.enabled,
    })
    .where(eq(rules.id, ruleId));
  revalidatePath("/reguly");
  return { ok: true, data: undefined };
}

export async function toggleRule(ruleId: number, enabled: boolean): Promise<ActionResult> {
  await db.update(rules).set({ enabled }).where(eq(rules.id, ruleId));
  revalidatePath("/reguly");
  return { ok: true, data: undefined };
}

export async function deleteRule(ruleId: number): Promise<ActionResult> {
  await db.delete(rules).where(eq(rules.id, ruleId));
  revalidatePath("/reguly");
  return { ok: true, data: undefined };
}

export async function previewRule(
  ruleId: number,
): Promise<ActionResult<DryRunResult>> {
  const result = await dryRunRule(ruleId);
  if (!result) return { ok: false, error: "Nie udało się przygotować podglądu reguły" };
  return { ok: true, data: result };
}

export async function runRule(ruleId: number): Promise<ActionResult<{ applied: number; skippedByLimit: number }>> {
  const result = await applyRule(ruleId);
  if (!result) return { ok: false, error: "Nie udało się wykonać reguły" };
  revalidatePath("/reguly");
  revalidatePath("/magazyn");
  revalidatePath("/historia");
  return { ok: true, data: result };
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { accounts, ACCOUNT_ADAPTERS } from "@/db/schema";

const accountSchema = z.object({
  name: z.string().trim().min(1, "Nazwa konta jest wymagana"),
  adapter: z.enum(ACCOUNT_ADAPTERS),
  activeListingLimit: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Limit musi być liczbą całkowitą" });
        return z.NEVER;
      }
      return n;
    })
    .nullable(),
});

function parseAccount(formData: FormData) {
  return accountSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    adapter: String(formData.get("adapter") ?? "manual"),
    activeListingLimit: String(formData.get("activeListingLimit") ?? ""),
  });
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = parseAccount(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  await db.insert(accounts).values(parsed.data);
  revalidatePath("/konta");
  return { ok: true, data: undefined };
}

export async function updateAccount(
  accountId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseAccount(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  await db.update(accounts).set(parsed.data).where(eq(accounts.id, accountId));
  revalidatePath("/konta");
  return { ok: true, data: undefined };
}

export async function deleteAccount(accountId: number): Promise<ActionResult> {
  try {
    await db.delete(accounts).where(eq(accounts.id, accountId));
  } catch {
    return {
      ok: false,
      error:
        "Nie można usunąć konta, które ma ogłoszenia — najpierw usuń lub przenieś jego ogłoszenia.",
    };
  }
  revalidatePath("/konta");
  return { ok: true, data: undefined };
}

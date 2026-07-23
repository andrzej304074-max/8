"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { scheduleSettingsSchema } from "@/lib/schedule-settings";

const formSchema = z
  .object({
    itemsPerDay: z.coerce.number().int().min(1).max(50),
    windowStartHour: z.coerce.number().int().min(0).max(23),
    windowEndHour: z.coerce.number().int().min(1).max(24),
    jitterMinutes: z.coerce.number().int().min(0).max(180),
    days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Zaznacz co najmniej jeden dzień"),
    maxOpsPerHour: z.string().trim(),
    maxOpsPerDay: z.string().trim(),
  })
  .refine((v) => v.windowStartHour < v.windowEndHour, {
    message: "Godzina początkowa musi być wcześniejsza niż końcowa",
    path: ["windowEndHour"],
  });

function parseOptionalInt(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export async function saveSchedule(
  accountId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = formSchema.safeParse({
    itemsPerDay: formData.get("itemsPerDay"),
    windowStartHour: formData.get("windowStartHour"),
    windowEndHour: formData.get("windowEndHour"),
    jitterMinutes: formData.get("jitterMinutes"),
    days: formData.getAll("days"),
    maxOpsPerHour: String(formData.get("maxOpsPerHour") ?? ""),
    maxOpsPerDay: String(formData.get("maxOpsPerDay") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const settings = scheduleSettingsSchema.parse({
    itemsPerDay: parsed.data.itemsPerDay,
    windowStartHour: parsed.data.windowStartHour,
    windowEndHour: parsed.data.windowEndHour,
    days: parsed.data.days,
    jitterMinutes: parsed.data.jitterMinutes,
  });

  await db
    .update(accounts)
    .set({
      scheduleSettings: JSON.stringify(settings),
      maxOpsPerHour: parseOptionalInt(parsed.data.maxOpsPerHour),
      maxOpsPerDay: parseOptionalInt(parsed.data.maxOpsPerDay),
    })
    .where(eq(accounts.id, accountId));

  revalidatePath("/ustawienia");
  revalidatePath("/kolejka");
  return { ok: true, data: undefined };
}

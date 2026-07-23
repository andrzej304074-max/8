"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateForItem } from "@/ai/service";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { items } from "@/db/schema";
import type { AiSuggestionRecord } from "@/ai/schema";
import { parsePlnToGrosze } from "@/domain/finance/money";

function readRecord(raw: string | null): AiSuggestionRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiSuggestionRecord;
  } catch {
    return null;
  }
}

export async function generateAiSuggestion(
  itemId: number,
  options: { force?: boolean } = {},
): Promise<ActionResult> {
  try {
    const outcome = await generateForItem(itemId, options);
    const record: AiSuggestionRecord = {
      data: outcome.data,
      generatedAt: new Date().toISOString(),
      fromCache: outcome.fromCache,
      appliedAt: null,
    };
    await db
      .update(items)
      .set({ aiSuggestion: JSON.stringify(record) })
      .where(eq(items.id, itemId));
    revalidatePath(`/magazyn/${itemId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Nieznany błąd generowania",
    };
  }
}

const applySchema = z.object({
  title: z.string().trim().min(1, "Tytuł jest wymagany").max(60, "Tytuł: maksymalnie 60 znaków"),
  description: z.string().trim().min(1, "Opis jest wymagany"),
  brand: z.string().trim(),
  category: z.string().trim(),
  size: z.string().trim(),
  condition: z.string().trim(),
  color: z.string().trim(),
  material: z.string().trim(),
  price: z.string().trim(),
});

export async function applyAiSuggestion(
  itemId: number,
  formData: FormData,
): Promise<ActionResult> {
  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  if (!item) {
    return { ok: false, error: "Przedmiot nie istnieje" };
  }
  const record = readRecord(item.aiSuggestion);
  if (!record) {
    return { ok: false, error: "Brak wygenerowanej sugestii do zastosowania" };
  }

  const raw = Object.fromEntries(
    ["title", "description", "brand", "category", "size", "condition", "color", "material", "price"].map(
      (k) => [k, String(formData.get(k) ?? "")],
    ),
  );
  const parsed = applySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const values = parsed.data;

  // Marka o niskiej pewności wymaga jawnego potwierdzenia (UI wymusza checkbox,
  // serwer sprawdza ponownie — nic nie idzie dalej bez akceptacji).
  if (
    record.data.brand_confidence === "low" &&
    values.brand !== "" &&
    formData.get("brandConfirmed") !== "on"
  ) {
    return { ok: false, error: "Potwierdź markę — AI nie było jej pewne." };
  }

  let priceGr: number | null = null;
  if (values.price !== "") {
    priceGr = parsePlnToGrosze(values.price);
    if (priceGr === null) {
      return { ok: false, error: "Nieprawidłowa cena" };
    }
  }

  const updatedRecord: AiSuggestionRecord = {
    ...record,
    data: { ...record.data, title: values.title, description: values.description },
    appliedAt: new Date().toISOString(),
  };

  await db
    .update(items)
    .set({
      brand: values.brand || null,
      category: values.category || null,
      size: values.size || null,
      condition: values.condition || null,
      color: values.color || null,
      material: values.material || null,
      expectedPriceGr: priceGr,
      aiSuggestion: JSON.stringify(updatedRecord),
    })
    .where(eq(items.id, itemId));

  revalidatePath(`/magazyn/${itemId}`);
  revalidatePath("/magazyn");
  return { ok: true, data: undefined };
}

export async function discardAiSuggestion(itemId: number): Promise<ActionResult> {
  await db.update(items).set({ aiSuggestion: null }).where(eq(items.id, itemId));
  revalidatePath(`/magazyn/${itemId}`);
  return { ok: true, data: undefined };
}

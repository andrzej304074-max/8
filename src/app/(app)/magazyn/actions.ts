"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { items, photos, ITEM_STATUSES, type ItemStatus } from "@/db/schema";
import { itemFormFromFormData, itemFormSchema } from "@/lib/item-form";
import { getStorage } from "@/storage";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".")}: ${issue.message}` : "Nieprawidłowe dane";
}

export async function createItem(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  const parsed = itemFormSchema.safeParse(itemFormFromFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }
  const [created] = await db
    .insert(items)
    .values(parsed.data)
    .returning({ id: items.id });
  if (!created) {
    return { ok: false, error: "Nie udało się zapisać przedmiotu" };
  }
  revalidatePath("/magazyn");
  return { ok: true, data: { id: created.id } };
}

export async function updateItem(
  itemId: number,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = itemFormSchema.safeParse(itemFormFromFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }
  await db.update(items).set(parsed.data).where(eq(items.id, itemId));
  revalidatePath("/magazyn");
  revalidatePath(`/magazyn/${itemId}`);
  return { ok: true, data: undefined };
}

export async function deleteItem(itemId: number): Promise<never> {
  const itemPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.itemId, itemId));

  // Najpierw baza (kaskada usuwa rekordy zdjęć), potem pliki — osierocony plik
  // jest tańszy niż rekord wskazujący na nieistniejący plik.
  await db.delete(items).where(eq(items.id, itemId));

  const storage = getStorage();
  for (const photo of itemPhotos) {
    await storage.delete(photo.originalKey).catch(() => undefined);
    if (photo.processedKey) {
      await storage.delete(photo.processedKey).catch(() => undefined);
    }
  }

  revalidatePath("/magazyn");
  redirect("/magazyn");
}

const bulkSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  status: z.enum(ITEM_STATUSES).optional(),
  location: z.string().trim().min(1).optional(),
});

export async function bulkUpdateItems(input: {
  ids: number[];
  status?: ItemStatus;
  location?: string;
}): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }
  const { ids, status, location } = parsed.data;
  if (status === undefined && location === undefined) {
    return { ok: false, error: "Wybierz, co zmienić" };
  }
  await db
    .update(items)
    .set({
      ...(status !== undefined ? { status } : {}),
      ...(location !== undefined ? { location } : {}),
    })
    .where(inArray(items.id, ids));
  revalidatePath("/magazyn");
  return { ok: true, data: { count: ids.length } };
}

export async function deletePhoto(photoId: number): Promise<ActionResult> {
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
  if (!photo) {
    return { ok: false, error: "Zdjęcie nie istnieje" };
  }
  await db.delete(photos).where(eq(photos.id, photoId));

  const storage = getStorage();
  await storage.delete(photo.originalKey).catch(() => undefined);
  if (photo.processedKey) {
    await storage.delete(photo.processedKey).catch(() => undefined);
  }

  // Gdy zniknęło zdjęcie główne, głównym zostaje pierwsze w kolejności.
  if (photo.isMain) {
    const [next] = await db
      .select()
      .from(photos)
      .where(eq(photos.itemId, photo.itemId))
      .orderBy(photos.position)
      .limit(1);
    if (next) {
      await db.update(photos).set({ isMain: true }).where(eq(photos.id, next.id));
    }
  }

  revalidatePath(`/magazyn/${photo.itemId}`);
  return { ok: true, data: undefined };
}

export async function setMainPhoto(photoId: number): Promise<ActionResult> {
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
  if (!photo) {
    return { ok: false, error: "Zdjęcie nie istnieje" };
  }
  await db
    .update(photos)
    .set({ isMain: false })
    .where(eq(photos.itemId, photo.itemId));
  await db.update(photos).set({ isMain: true }).where(eq(photos.id, photoId));
  revalidatePath(`/magazyn/${photo.itemId}`);
  return { ok: true, data: undefined };
}

export async function movePhoto(
  photoId: number,
  direction: "up" | "down",
): Promise<ActionResult> {
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId));
  if (!photo) {
    return { ok: false, error: "Zdjęcie nie istnieje" };
  }
  const siblings = await db
    .select()
    .from(photos)
    .where(eq(photos.itemId, photo.itemId))
    .orderBy(photos.position);

  const index = siblings.findIndex((p) => p.id === photoId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const target = siblings[targetIndex];
  if (!target) {
    return { ok: true, data: undefined };
  }

  await db
    .update(photos)
    .set({ position: target.position })
    .where(eq(photos.id, photo.id));
  await db
    .update(photos)
    .set({ position: photo.position })
    .where(eq(photos.id, target.id));

  revalidatePath(`/magazyn/${photo.itemId}`);
  return { ok: true, data: undefined };
}

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { items, photos } from "@/db/schema";
import { processPhoto } from "@/lib/images";
import { getStorage } from "@/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Nieprawidłowe ID przedmiotu" }, { status: 400 });
  }

  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  if (!item) {
    return NextResponse.json({ error: "Przedmiot nie istnieje" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Brak pliku w polu 'file'" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Nieobsługiwany format: ${file.type || "nieznany"}. Użyj JPG, PNG lub WebP.` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Plik jest większy niż 20 MB" }, { status: 413 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await processPhoto(input);
  } catch {
    return NextResponse.json(
      { error: `Nie udało się przetworzyć pliku ${file.name} — czy to na pewno zdjęcie?` },
      { status: 422 },
    );
  }

  const storage = getStorage();
  const baseKey = `items/${itemId}/${crypto.randomUUID()}`;
  const originalKey = await storage.put(`${baseKey}-org.jpg`, result.original, "image/jpeg");
  const processedKey = await storage.put(`${baseKey}-web.jpg`, result.processed, "image/jpeg");

  const existing = await db
    .select({ id: photos.id, position: photos.position })
    .from(photos)
    .where(eq(photos.itemId, itemId))
    .orderBy(asc(photos.position));

  const lastPosition = existing.at(-1)?.position ?? -1;
  const [created] = await db
    .insert(photos)
    .values({
      itemId,
      position: lastPosition + 1,
      isMain: existing.length === 0,
      originalKey,
      processedKey,
    })
    .returning();

  revalidatePath(`/magazyn/${itemId}`);
  revalidatePath("/magazyn");

  return NextResponse.json({
    id: created?.id,
    url: created ? storage.publicUrl(processedKey) : null,
  });
}

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiCache, photos } from "@/db/schema";
import { config } from "@/lib/config";
import { getStorage } from "@/storage";
import { runGeneration } from "./generate";
import { GeminiProvider } from "./gemini";
import { photoSetHash } from "./hash";
import { aiListingSchema, type AiListing } from "./schema";

const MAX_PHOTOS = 8;

export interface GenerationOutcome {
  data: AiListing;
  fromCache: boolean;
}

/**
 * Generuje propozycję ogłoszenia dla przedmiotu: zdjęcia → cache → model.
 * `force` pomija odczyt cache (wynik i tak jest w nim zapisywany).
 */
export async function generateForItem(
  itemId: number,
  options: { force?: boolean } = {},
): Promise<GenerationOutcome> {
  if (!config.GEMINI_API_KEY) {
    throw new Error(
      "Brak klucza GEMINI_API_KEY. Wygeneruj darmowy klucz na aistudio.google.com " +
        "i dodaj go do pliku .env (lokalnie) lub zmiennych środowiskowych Vercel — instrukcja w README.",
    );
  }

  const photoRows = await db
    .select()
    .from(photos)
    .where(eq(photos.itemId, itemId))
    .orderBy(asc(photos.position))
    .limit(MAX_PHOTOS);

  if (photoRows.length === 0) {
    throw new Error("Przedmiot nie ma zdjęć — dodaj 1-8 zdjęć przed generowaniem.");
  }

  const storage = getStorage();
  const buffers = await Promise.all(
    photoRows.map((p) => storage.get(p.processedKey ?? p.originalKey)),
  );

  const hash = photoSetHash(buffers);

  if (!options.force) {
    const [cached] = await db
      .select()
      .from(aiCache)
      .where(eq(aiCache.photoSetHash, hash));
    if (cached) {
      const parsed = aiListingSchema.safeParse(JSON.parse(cached.response));
      if (parsed.success) {
        return { data: parsed.data, fromCache: true };
      }
      // Wpis w cache z niekompatybilnym schematem (np. po zmianie schematu) — usuń i generuj na nowo.
      await db.delete(aiCache).where(eq(aiCache.photoSetHash, hash));
    }
  }

  const provider = new GeminiProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL);
  const data = await runGeneration(
    provider,
    buffers.map((buf) => ({ data: buf, mimeType: "image/jpeg" })),
  );

  await db
    .insert(aiCache)
    .values({ photoSetHash: hash, response: JSON.stringify(data) })
    .onConflictDoUpdate({
      target: aiCache.photoSetHash,
      set: { response: JSON.stringify(data) },
    });

  return { data, fromCache: false };
}

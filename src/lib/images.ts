import sharp from "sharp";

export interface ProcessedPhoto {
  /** Pełna rozdzielczość, skorygowana orientacja, ZERO metadanych (w tym GPS). */
  original: Buffer;
  /** Wersja pod platformę: przeskalowana i skompresowana, również bez metadanych. */
  processed: Buffer;
  width: number;
  height: number;
}

// Vinted i tak przeskalowuje zdjęcia — 1600 px na dłuższym boku to zapas jakości
// przy rozsądnym rozmiarze pliku.
const PROCESSED_MAX_DIM = 1600;

/**
 * Jedyna droga zdjęcia do magazynu. sharp domyślnie NIE przepisuje metadanych
 * do pliku wynikowego, a `.rotate()` bez argumentów trwale nanosi orientację EXIF —
 * dzięki temu żaden zapisany plik nie zawiera EXIF, geolokalizacji ani miniatur EXIF.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  const oriented = () => sharp(input).rotate();

  const original = await oriented().jpeg({ quality: 92 }).toBuffer();
  const { data: processed, info } = await oriented()
    .resize({
      width: PROCESSED_MAX_DIM,
      height: PROCESSED_MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return { original, processed, width: info.width, height: info.height };
}

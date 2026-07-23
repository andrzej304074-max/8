// Przygotowanie zdjęcia po stronie przeglądarki przed wysyłką:
// wstępne przeskalowanie zmniejsza transfer i mieści upload w limicie
// rozmiaru żądania na Vercel (4,5 MB). Ponowne kodowanie przez canvas
// usuwa też EXIF już w przeglądarce — serwer i tak czyści go ponownie.

const MAX_DIM = 2400;
const RAW_FALLBACK_LIMIT = 4 * 1024 * 1024;

export async function prepareImageForUpload(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Brak kontekstu canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) throw new Error("canvas.toBlob nie zwrócił danych");
    return blob;
  } catch {
    // Przeglądarka nie umie zdekodować pliku (np. HEIC poza Safari) —
    // mały plik wyślemy w oryginale, duży musi zostać przekonwertowany ręcznie.
    if (file.size <= RAW_FALLBACK_LIMIT) {
      return file;
    }
    throw new Error(
      `Nie udało się przetworzyć pliku ${file.name}. Przekonwertuj go do JPG (np. w telefonie: udostępnij → zapisz jako zdjęcie).`,
    );
  }
}

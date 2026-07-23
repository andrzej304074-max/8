import { config } from "@/lib/config";
import { LocalStorageProvider } from "./local";
import { VercelBlobProvider } from "./vercel-blob";

/**
 * Abstrakcja nad miejscem przechowywania zdjęć — reszta aplikacji nie wie,
 * czy pliki leżą na dysku (development), czy w Vercel Blob (produkcja).
 * "Klucz" to dla dysku ścieżka względna, a dla Blob pełny adres URL.
 */
export interface StorageProvider {
  /** Zapisuje plik i zwraca jego klucz. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Odczytuje plik (np. do wysłania zdjęć do modelu wizyjnego). */
  get(key: string): Promise<Buffer>;
  /** Usuwa plik; brak pliku nie jest błędem. */
  delete(key: string): Promise<void>;
  /** Adres, pod którym przeglądarka zobaczy plik. */
  publicUrl(key: string): string;
}

let instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!instance) {
    instance = config.BLOB_READ_WRITE_TOKEN
      ? new VercelBlobProvider(config.BLOB_READ_WRITE_TOKEN)
      : new LocalStorageProvider();
  }
  return instance;
}

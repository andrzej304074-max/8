import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./index";

const BASE_DIR = path.resolve(process.cwd(), "data", "uploads");

/** Zwraca ścieżkę absolutną klucza, odrzucając próby wyjścia poza katalog uploadów. */
export function resolveUploadPath(key: string): string {
  const abs = path.resolve(BASE_DIR, key);
  if (!abs.startsWith(BASE_DIR + path.sep)) {
    throw new Error(`Nieprawidłowy klucz pliku: ${key}`);
  }
  return abs;
}

export class LocalStorageProvider implements StorageProvider {
  async put(key: string, data: Buffer, _contentType: string): Promise<string> {
    const abs = resolveUploadPath(key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(resolveUploadPath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(resolveUploadPath(key), { force: true });
  }

  publicUrl(key: string): string {
    return `/api/photos/${key}`;
  }
}

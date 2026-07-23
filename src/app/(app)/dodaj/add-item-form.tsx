"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { createItem } from "@/app/(app)/magazyn/actions";
import { ItemFields } from "@/components/item-fields";
import { prepareImageForUpload } from "@/lib/client-image";

interface PickedFile {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_PHOTOS = 20;

export function AddItemForm() {
  const router = useRouter();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setError(null);
    setFiles((current) => {
      const next = [...current];
      for (const file of Array.from(incoming)) {
        if (!file.type.startsWith("image/")) continue;
        if (next.length >= MAX_PHOTOS) break;
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }, []);

  const move = (id: string, dir: -1 | 1) => {
    setFiles((current) => {
      const idx = current.findIndex((f) => f.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const a = next[idx];
      const b = next[target];
      if (!a || !b) return current;
      next[idx] = b;
      next[target] = a;
      return next;
    });
  };

  const remove = (id: string) => {
    setFiles((current) => {
      const found = current.find((f) => f.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return current.filter((f) => f.id !== id);
    });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setProgress("Zapisywanie przedmiotu…");

    const formData = new FormData(event.currentTarget);
    const result = await createItem(formData);
    if (!result.ok) {
      setProgress(null);
      setError(result.error);
      return;
    }

    const itemId = result.data.id;
    // Wysyłka sekwencyjna: kolejność przybycia na serwer wyznacza kolejność zdjęć,
    // a pierwsze zdjęcie zostaje głównym.
    for (let i = 0; i < files.length; i++) {
      const picked = files[i];
      if (!picked) continue;
      setProgress(`Wysyłanie zdjęcia ${i + 1} z ${files.length}…`);
      try {
        const blob = await prepareImageForUpload(picked.file);
        const body = new FormData();
        body.append("file", blob, picked.file.name);
        const response = await fetch(`/api/items/${itemId}/photos`, {
          method: "POST",
          body,
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? `Błąd serwera (${response.status})`);
        }
      } catch (err) {
        setProgress(null);
        setError(
          `Przedmiot zapisany, ale zdjęcie ${i + 1} nie zostało wysłane: ` +
            `${err instanceof Error ? err.message : "nieznany błąd"}. ` +
            `Pozostałe zdjęcia dodasz na karcie przedmiotu.`,
        );
        router.push(`/magazyn/${itemId}`);
        return;
      }
    }

    setProgress(null);
    router.push(`/magazyn/${itemId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Zdjęcia</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
            dragOver
              ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-800"
              : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          Przeciągnij i upuść zdjęcia albo kliknij, aby wybrać (JPG, PNG, WebP; maks. {MAX_PHOTOS})
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 ? (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {files.map((f, idx) => (
              <li key={f.id} className="rounded border border-zinc-200 p-1 dark:border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.previewUrl}
                  alt={`Zdjęcie ${idx + 1}`}
                  className="aspect-square w-full rounded object-cover"
                />
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">
                    {idx === 0 ? "główne" : `#${idx + 1}`}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => move(f.id, -1)} title="Przesuń w lewo">
                      ←
                    </button>
                    <button type="button" onClick={() => move(f.id, 1)} title="Przesuń w prawo">
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      title="Usuń zdjęcie"
                      className="text-red-600 dark:text-red-400"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Dane przedmiotu</h2>
        <ItemFields />
      </section>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={progress !== null}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Zapisz przedmiot
        </button>
        {progress ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{progress}</span>
        ) : null}
      </div>
    </form>
  );
}

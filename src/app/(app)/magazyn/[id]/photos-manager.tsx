"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  deletePhoto,
  movePhoto,
  setMainPhoto,
} from "@/app/(app)/magazyn/actions";
import { prepareImageForUpload } from "@/lib/client-image";

export interface PhotoView {
  id: number;
  url: string;
  isMain: boolean;
}

export function PhotosManager({
  itemId,
  photos,
}: {
  itemId: number;
  photos: PhotoView[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function uploadFiles(list: FileList | File[]) {
    setError(null);
    const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      setProgress(`Wysyłanie zdjęcia ${i + 1} z ${files.length}…`);
      try {
        const blob = await prepareImageForUpload(file);
        const body = new FormData();
        body.append("file", blob, file.name);
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
        setError(err instanceof Error ? err.message : "Nieznany błąd wysyłki");
        break;
      }
    }
    setProgress(null);
    router.refresh();
  }

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
    });
  };

  return (
    <div className="space-y-3">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, idx) => (
            <li
              key={photo.id}
              className="rounded border border-zinc-200 p-1 dark:border-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Zdjęcie ${idx + 1}`}
                className="aspect-square w-full rounded object-cover"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                {photo.isMain ? (
                  <span className="font-medium">główne</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => setMainPhoto(photo.id))}
                    className="underline"
                  >
                    ustaw główne
                  </button>
                )}
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending || idx === 0}
                    onClick={() => act(() => movePhoto(photo.id, "up"))}
                    title="Przesuń wcześniej"
                    className="disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={pending || idx === photos.length - 1}
                    onClick={() => act(() => movePhoto(photo.id, "down"))}
                    title="Przesuń później"
                    className="disabled:opacity-30"
                  >
                    →
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("Usunąć to zdjęcie? Tej operacji nie można cofnąć.")) {
                        act(() => deletePhoto(photo.id));
                      }
                    }}
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
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Brak zdjęć.</p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
          dragOver
            ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-800"
            : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        }`}
      >
        Dodaj zdjęcia: przeciągnij tutaj albo kliknij
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {progress ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{progress}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

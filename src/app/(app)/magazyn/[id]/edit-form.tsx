"use client";

import { useState, useTransition } from "react";
import { deleteItem, updateItem } from "@/app/(app)/magazyn/actions";
import { ItemFields } from "@/components/item-fields";
import type { items } from "@/db/schema";

type Item = typeof items.$inferSelect;

export function EditItemForm({ item }: { item: Item }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateItem(item.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Usunąć przedmiot „${item.name}" wraz ze zdjęciami? Tej operacji nie można cofnąć.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      await deleteItem(item.id);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ItemFields defaults={item} showStatus />

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {saved ? (
        <p className="text-sm text-green-700 dark:text-green-400">Zapisano zmiany.</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Zapisywanie…" : "Zapisz zmiany"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Usuń przedmiot
        </button>
      </div>
    </form>
  );
}

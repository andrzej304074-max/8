import { AddItemForm } from "./add-item-form";

export default function DodajPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Dodaj przedmiot</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Zdjęcia są automatycznie skalowane, a wszystkie metadane EXIF — w tym
        geolokalizacja — usuwane przed zapisem. Generowanie opisu przez AI pojawi
        się w Etapie 3.
      </p>
      <AddItemForm />
    </div>
  );
}

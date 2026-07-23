import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { items, photos } from "@/db/schema";
import { daysInStock } from "@/domain/inventory/staleness";
import { getStorage } from "@/storage";
import { EditItemForm } from "./edit-form";
import { PhotosManager, type PhotoView } from "./photos-manager";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  if (!item) notFound();

  const storage = getStorage();
  const photoRows = await db
    .select()
    .from(photos)
    .where(eq(photos.itemId, itemId))
    .orderBy(asc(photos.position));

  const photoViews: PhotoView[] = photoRows.map((p) => ({
    id: p.id,
    url: storage.publicUrl(p.processedKey ?? p.originalKey),
    isMain: p.isMain,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          w magazynie od {daysInStock(item.createdAt)} dni
        </span>
        <Link href="/magazyn" className="ml-auto text-sm underline">
          ← wróć do magazynu
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Zdjęcia</h2>
          <PhotosManager itemId={item.id} photos={photoViews} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Dane przedmiotu</h2>
          <EditItemForm item={item} />
        </section>
      </div>
    </div>
  );
}

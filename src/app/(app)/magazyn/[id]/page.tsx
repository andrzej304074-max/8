import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AiSuggestionRecord } from "@/ai/schema";
import { db } from "@/db";
import { accounts, items, listings, photos } from "@/db/schema";
import { daysInStock } from "@/domain/inventory/staleness";
import { getStorage } from "@/storage";
import { AiPanel } from "./ai-panel";
import { EditItemForm } from "./edit-form";
import {
  ListingsPanel,
  type AccountOption,
  type ListingSummary,
} from "./listings-panel";
import { PhotosManager, type PhotoView } from "./photos-manager";

export const dynamic = "force-dynamic";
// Generowanie AI potrafi trwać kilkadziesiąt sekund — podnosimy limit funkcji na Vercel.
export const maxDuration = 60;

function readAiRecord(raw: string | null): AiSuggestionRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiSuggestionRecord;
  } catch {
    return null;
  }
}

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

  const accountRows = await db.select().from(accounts);
  const accountOptions: AccountOption[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    adapter: a.adapter,
  }));
  const accountNameById = new Map(accountRows.map((a) => [a.id, a.name]));

  const listingRows = await db
    .select()
    .from(listings)
    .where(eq(listings.itemId, itemId));
  const listingSummaries: ListingSummary[] = listingRows.map((l) => ({
    id: l.id,
    accountName: accountNameById.get(l.accountId) ?? `konto #${l.accountId}`,
    status: l.status,
    priceGr: l.priceGr,
    publishedAt: l.publishedAt,
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
        <section className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Zdjęcia</h2>
            <PhotosManager itemId={item.id} photos={photoViews} />
          </div>
          <AiPanel itemId={item.id} record={readAiRecord(item.aiSuggestion)} />
          <ListingsPanel
            itemId={item.id}
            listings={listingSummaries}
            accounts={accountOptions}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Dane przedmiotu</h2>
          {/* Klucz wymusza remount formularza po zmianach z zewnątrz (np. Zastosuj z AI). */}
          <EditItemForm key={item.updatedAt} item={item} />
        </section>
      </div>
    </div>
  );
}

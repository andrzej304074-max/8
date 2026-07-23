import { and, desc, eq, inArray, isNotNull, lt, type SQL } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { items, photos, ITEM_STATUSES, type ItemStatus } from "@/db/schema";
import { daysInStock } from "@/domain/inventory/staleness";
import { getStorage } from "@/storage";
import { Filters } from "./filters";
import { ItemsGrid } from "./items-grid";
import { ItemsTable, type ItemRow } from "./items-table";

// Dane magazynu muszą być zawsze świeże — bez prerenderu w czasie builda.
export const dynamic = "force-dynamic";

const AGE_OPTIONS = ["7", "30", "60", "90"] as const;

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function MagazynPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = asString(params.status);
  const marka = asString(params.marka);
  const kategoria = asString(params.kategoria);
  const rozmiar = asString(params.rozmiar);
  const wiek = asString(params.wiek);
  const widok = asString(params.widok) === "siatka" ? "siatka" : "tabela";

  const conditions: SQL[] = [];
  if (status && (ITEM_STATUSES as readonly string[]).includes(status)) {
    conditions.push(eq(items.status, status as ItemStatus));
  }
  if (marka) conditions.push(eq(items.brand, marka));
  if (kategoria) conditions.push(eq(items.category, kategoria));
  if (rozmiar) conditions.push(eq(items.size, rozmiar));
  if (wiek && (AGE_OPTIONS as readonly string[]).includes(wiek)) {
    const cutoff = new Date(Date.now() - Number(wiek) * 86_400_000).toISOString();
    conditions.push(lt(items.createdAt, cutoff));
  }

  const rows = await db
    .select()
    .from(items)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(items.createdAt));

  // Miniatura: zdjęcie główne, a gdy go brak — pierwsze w kolejności.
  const storage = getStorage();
  const photoByItem = new Map<number, string>();
  if (rows.length > 0) {
    const photoRows = await db
      .select()
      .from(photos)
      .where(
        inArray(
          photos.itemId,
          rows.map((r) => r.id),
        ),
      );
    photoRows.sort((a, b) => a.position - b.position);
    for (const p of photoRows) {
      const key = p.processedKey ?? p.originalKey;
      if (p.isMain || !photoByItem.has(p.itemId)) {
        photoByItem.set(p.itemId, storage.publicUrl(key));
      }
    }
  }

  const itemRows: ItemRow[] = rows.map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    category: item.category,
    size: item.size,
    condition: item.condition,
    expectedPriceGr: item.expectedPriceGr,
    status: item.status,
    location: item.location,
    days: daysInStock(item.createdAt),
    photoUrl: photoByItem.get(item.id) ?? null,
  }));

  const distinct = async (
    column: typeof items.brand | typeof items.category | typeof items.size,
  ) =>
    (
      await db
        .selectDistinct({ v: column })
        .from(items)
        .where(isNotNull(column))
    )
      .map((r) => r.v)
      .filter((v): v is string => v !== null)
      .sort((a, b) => a.localeCompare(b, "pl"));

  const [brands, categories, sizes] = await Promise.all([
    distinct(items.brand),
    distinct(items.category),
    distinct(items.size),
  ]);

  const viewParams = new URLSearchParams();
  for (const [k, v] of Object.entries({ status, marka, kategoria, rozmiar, wiek })) {
    if (v) viewParams.set(k, v);
  }
  const tableHref = `/magazyn?${new URLSearchParams({ ...Object.fromEntries(viewParams), widok: "tabela" })}`;
  const gridHref = `/magazyn?${new URLSearchParams({ ...Object.fromEntries(viewParams), widok: "siatka" })}`;

  const hasFilters = Boolean(status || marka || kategoria || rozmiar || wiek);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Magazyn</h1>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {itemRows.length} {itemRows.length === 1 ? "przedmiot" : "przedmiotów"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/magazyn/zalegajace"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Zalegające
          </Link>
          <Link
            href="/dodaj"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Dodaj przedmiot
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Filters
          current={{ status, marka, kategoria, rozmiar, wiek, widok }}
          brands={brands}
          categories={categories}
          sizes={sizes}
        />
        <div className="ml-auto flex gap-1 text-sm">
          <Link
            href={tableHref}
            className={`rounded px-2.5 py-1.5 ${widok === "tabela" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
          >
            Tabela
          </Link>
          <Link
            href={gridHref}
            className={`rounded px-2.5 py-1.5 ${widok === "siatka" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
          >
            Siatka
          </Link>
        </div>
      </div>

      {itemRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          {hasFilters ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Brak przedmiotów pasujących do filtrów.
            </p>
          ) : (
            <>
              <p className="mb-1 font-medium">Magazyn jest pusty</p>
              <Link href="/dodaj" className="text-sm underline">
                Dodaj pierwszy przedmiot
              </Link>
            </>
          )}
        </div>
      ) : widok === "siatka" ? (
        <ItemsGrid items={itemRows} />
      ) : (
        <ItemsTable items={itemRows} />
      )}
    </div>
  );
}

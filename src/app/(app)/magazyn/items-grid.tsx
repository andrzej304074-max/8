import Link from "next/link";
import { formatPln } from "@/domain/finance/money";
import { STATUS_LABELS } from "@/lib/labels";
import type { ItemRow } from "./items-table";

export function ItemsGrid({ items }: { items: ItemRow[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/magazyn/${item.id}`}
            className="block rounded-lg border border-zinc-200 bg-white p-2 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            {item.photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.photoUrl}
                alt={item.name}
                className="aspect-square w-full rounded object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded bg-zinc-200 text-xs text-zinc-500 dark:bg-zinc-800">
                brak zdjęcia
              </div>
            )}
            <div className="mt-2 space-y-0.5 text-sm">
              <p className="truncate font-medium">{item.name}</p>
              <p className="flex items-baseline justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{STATUS_LABELS[item.status]}</span>
                <span>{item.days} dni</span>
              </p>
              <p className="text-sm">
                {item.expectedPriceGr !== null ? formatPln(item.expectedPriceGr) : "—"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

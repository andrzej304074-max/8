import Link from "next/link";
import { notFound } from "next/navigation";
import { buildManualPackage } from "@/adapters/package";
import { loadListingBundle } from "@/adapters/payload";
import { LISTING_STATUS_LABELS } from "@/lib/labels";
import { CopyBlock, PackageActions } from "./package-actions";

export const dynamic = "force-dynamic";

export default async function ListingPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) notFound();

  const bundle = await loadListingBundle(listingId);
  if (!bundle) notFound();

  const { listing, item, account, payload, aiFlags } = bundle;
  const pkg = buildManualPackage(payload, aiFlags);
  const isDryRun = account.adapter === "dry_run";

  return (
    <div className="max-w-3xl">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h1 className="text-xl font-semibold">Ogłoszenie #{listing.id}</h1>
        <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
          {LISTING_STATUS_LABELS[listing.status]}
        </span>
        {isDryRun ? (
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            konto dry run
          </span>
        ) : null}
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Przedmiot:{" "}
        <Link href={`/magazyn/${item.id}`} className="underline">
          {item.name}
        </Link>{" "}
        · konto: {account.name}
        {listing.publishedAt
          ? ` · opublikowane ${listing.publishedAt.slice(0, 10)}`
          : ""}
        {listing.externalId ? (
          <>
            {" · "}
            <a
              href={listing.externalId}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              zobacz na platformie
            </a>
          </>
        ) : null}
      </p>

      {pkg.warnings.length > 0 ? (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="mb-1 font-semibold">Zanim wkleisz — sprawdź:</p>
          <ul className="list-inside list-disc">
            {pkg.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mb-4 space-y-3">
        {pkg.copyBlocks.map((block) => (
          <CopyBlock key={block.label} label={block.label} value={block.value} />
        ))}
      </div>

      <div className="mb-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-100 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2 font-medium" colSpan={2}>
                Checklista pól do wyklikania na platformie
              </th>
            </tr>
          </thead>
          <tbody>
            {pkg.checklist.map((entry) => (
              <tr
                key={entry.label}
                className="border-b border-zinc-200 last:border-0 dark:border-zinc-800"
              >
                <td className="w-32 px-3 py-2 font-medium">{entry.label}</td>
                <td className="px-3 py-2">
                  {entry.value ?? (
                    <span className="text-amber-600 dark:text-amber-400">
                      brak — uzupełnij ręcznie
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <h2 className="mb-2 text-sm font-semibold">
          Zdjęcia ({pkg.photoUrls.length}) — kliknij, aby otworzyć i zapisać
        </h2>
        {pkg.photoUrls.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {pkg.photoUrls.map((url, idx) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Zdjęcie ${idx + 1}`}
                    className="aspect-square w-full rounded border border-zinc-200 object-cover hover:opacity-80 dark:border-zinc-800"
                  />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Brak zdjęć.</p>
        )}
      </div>

      <PackageActions
        listingId={listing.id}
        status={listing.status}
        isDryRun={isDryRun}
      />
    </div>
  );
}

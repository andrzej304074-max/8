import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, listings } from "@/db/schema";
import { AccountsManager, type AccountRow } from "./accounts-manager";

export const dynamic = "force-dynamic";

export default async function KontaPage() {
  const accountRows = await db.select().from(accounts);

  const rows: AccountRow[] = await Promise.all(
    accountRows.map(async (account) => {
      const published = await db
        .select({ id: listings.id })
        .from(listings)
        .where(and(eq(listings.accountId, account.id), eq(listings.status, "published")));
      return {
        id: account.id,
        name: account.name,
        adapter: account.adapter,
        activeListingLimit: account.activeListingLimit,
        publishedCount: published.length,
      };
    }),
  );

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Konta</h1>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Konta, na których wystawiasz. Tryb ręczny przygotowuje paczkę do
        wklejenia; dry run tylko loguje operacje do Historii. Automatyczna
        publikacja (z sesją) pojawi się w Etapie 8.
      </p>
      <AccountsManager accounts={rows} />
    </div>
  );
}

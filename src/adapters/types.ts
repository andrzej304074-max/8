import type { accounts } from "@/db/schema";

export type Account = typeof accounts.$inferSelect;

/** Kompletny zestaw danych ogłoszenia przekazywany adapterowi. */
export interface ListingPayload {
  listingId: number;
  itemId: number;
  title: string;
  description: string;
  priceGr: number | null;
  categoryPath: string[];
  condition: string | null;
  size: string | null;
  brand: string | null;
  colors: string[];
  material: string | null;
  photoUrls: string[];
}

/** Zapis do EventLog — adapter loguje, warstwa wyżej decyduje, jak trwale. */
export type AdapterLogger = (
  action: string,
  outcome: "ok" | "error",
  detail?: string,
  payload?: unknown,
) => Promise<void>;

export interface AdapterContext {
  account: Account;
  log: AdapterLogger;
}

/** Paczka do ręcznego wklejenia — jedyny "wynik" ManualAdaptera. */
export interface ManualPackage {
  /** Bloki do skopiowania jednym kliknięciem (tytuł, opis, cena). */
  copyBlocks: Array<{ label: string; value: string }>;
  /** Pola do ręcznego wyklikania w formularzu platformy. */
  checklist: Array<{ label: string; value: string | null }>;
  photoUrls: string[];
  warnings: string[];
}

export type PublishOutcome =
  | { kind: "published"; externalId: string | null }
  | { kind: "manual_package"; pkg: ManualPackage }
  | { kind: "logged" }
  | { kind: "unsupported"; reason: string };

export type SimpleOutcome =
  | { kind: "done" }
  | { kind: "logged" }
  | { kind: "unsupported"; reason: string };

export type FetchListingsOutcome =
  | { kind: "listings"; externalIds: string[] }
  | { kind: "unsupported"; reason: string };

export type FetchStatsOutcome =
  | { kind: "stats"; views: number; likes: number }
  | { kind: "unsupported"; reason: string };

/**
 * Wymienna warstwa integracji z platformą. ManualAdapter i DryRunAdapter nie
 * wykonują ŻADNYCH żądań sieciowych; VintedAdapter (Etap 8) doda realną
 * publikację z limitowaniem, backoffem i wyłącznikiem bezpieczeństwa —
 * reszta aplikacji rozmawia wyłącznie z tym interfejsem.
 */
export interface MarketplaceAdapter {
  readonly name: string;
  publish(payload: ListingPayload, ctx: AdapterContext): Promise<PublishOutcome>;
  update(payload: ListingPayload, ctx: AdapterContext): Promise<SimpleOutcome>;
  delete(externalId: string, ctx: AdapterContext): Promise<SimpleOutcome>;
  fetchListings(ctx: AdapterContext): Promise<FetchListingsOutcome>;
  fetchStats(externalId: string, ctx: AdapterContext): Promise<FetchStatsOutcome>;
  sendMessage(
    recipientId: string,
    text: string,
    ctx: AdapterContext,
  ): Promise<SimpleOutcome>;
}

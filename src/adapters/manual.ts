import { buildManualPackage } from "./package";
import type {
  AdapterContext,
  FetchListingsOutcome,
  FetchStatsOutcome,
  ListingPayload,
  MarketplaceAdapter,
  PublishOutcome,
  SimpleOutcome,
} from "./types";

const MANUAL_HINT =
  "Tryb ręczny: wykonaj operację w aplikacji/na stronie Vinted i zaktualizuj status tutaj.";

/**
 * Adapter domyślny. Zero żądań sieciowych — publikacja to wygenerowanie paczki
 * (tekst do skopiowania, zdjęcia, checklista), którą człowiek wkleja na platformę.
 */
export class ManualAdapter implements MarketplaceAdapter {
  readonly name = "manual";

  async publish(payload: ListingPayload, ctx: AdapterContext): Promise<PublishOutcome> {
    const pkg = buildManualPackage(payload);
    await ctx.log(
      "publish.manual_package",
      "ok",
      `Przygotowano paczkę do ręcznego wklejenia (ogłoszenie #${payload.listingId})`,
      { listingId: payload.listingId, title: payload.title },
    );
    return { kind: "manual_package", pkg };
  }

  async update(_payload: ListingPayload, _ctx: AdapterContext): Promise<SimpleOutcome> {
    return { kind: "unsupported", reason: MANUAL_HINT };
  }

  async delete(_externalId: string, _ctx: AdapterContext): Promise<SimpleOutcome> {
    return { kind: "unsupported", reason: MANUAL_HINT };
  }

  async fetchListings(_ctx: AdapterContext): Promise<FetchListingsOutcome> {
    return { kind: "unsupported", reason: MANUAL_HINT };
  }

  async fetchStats(
    _externalId: string,
    _ctx: AdapterContext,
  ): Promise<FetchStatsOutcome> {
    return { kind: "unsupported", reason: MANUAL_HINT };
  }

  async sendMessage(
    _recipientId: string,
    _text: string,
    _ctx: AdapterContext,
  ): Promise<SimpleOutcome> {
    return { kind: "unsupported", reason: MANUAL_HINT };
  }
}

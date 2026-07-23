import type {
  AdapterContext,
  FetchListingsOutcome,
  FetchStatsOutcome,
  ListingPayload,
  MarketplaceAdapter,
  PublishOutcome,
  SimpleOutcome,
} from "./types";

/**
 * Loguje do EventLog dokładnie to, co zostałoby wysłane — niczego nie wysyła.
 * Do testowania schedulera (Etap 5) i reguł relistingu (Etap 6) bez ryzyka.
 */
export class DryRunAdapter implements MarketplaceAdapter {
  readonly name = "dry_run";

  async publish(payload: ListingPayload, ctx: AdapterContext): Promise<PublishOutcome> {
    await ctx.log(
      "publish.dry_run",
      "ok",
      `DRY RUN: ogłoszenie #${payload.listingId} zostałoby opublikowane`,
      payload,
    );
    return { kind: "logged" };
  }

  async update(payload: ListingPayload, ctx: AdapterContext): Promise<SimpleOutcome> {
    await ctx.log(
      "update.dry_run",
      "ok",
      `DRY RUN: ogłoszenie #${payload.listingId} zostałoby zaktualizowane`,
      payload,
    );
    return { kind: "logged" };
  }

  async delete(externalId: string, ctx: AdapterContext): Promise<SimpleOutcome> {
    await ctx.log(
      "delete.dry_run",
      "ok",
      `DRY RUN: ogłoszenie ${externalId} zostałoby usunięte`,
      { externalId },
    );
    return { kind: "logged" };
  }

  async fetchListings(_ctx: AdapterContext): Promise<FetchListingsOutcome> {
    return { kind: "unsupported", reason: "Dry run nie pobiera danych z platformy." };
  }

  async fetchStats(
    _externalId: string,
    _ctx: AdapterContext,
  ): Promise<FetchStatsOutcome> {
    return { kind: "unsupported", reason: "Dry run nie pobiera danych z platformy." };
  }

  async sendMessage(
    recipientId: string,
    text: string,
    ctx: AdapterContext,
  ): Promise<SimpleOutcome> {
    await ctx.log(
      "message.dry_run",
      "ok",
      `DRY RUN: wiadomość do ${recipientId} zostałaby wysłana`,
      { recipientId, text },
    );
    return { kind: "logged" };
  }
}

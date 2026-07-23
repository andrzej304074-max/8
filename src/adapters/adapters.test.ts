import { describe, expect, it } from "vitest";
import { DryRunAdapter } from "./dry-run";
import { ManualAdapter } from "./manual";
import type { Account, AdapterContext, ListingPayload } from "./types";

const PAYLOAD: ListingPayload = {
  listingId: 7,
  itemId: 3,
  title: "Kurtka jeansowa L",
  description: "Klasyk.",
  priceGr: 3500,
  categoryPath: ["Kobiety", "Kurtki"],
  condition: "dobry",
  size: "L",
  brand: null,
  colors: ["niebieski"],
  material: null,
  photoUrls: ["/api/photos/x.jpg"],
};

function fakeCtx(): AdapterContext & {
  events: Array<{ action: string; outcome: string; payload?: unknown }>;
} {
  const events: Array<{ action: string; outcome: string; payload?: unknown }> = [];
  return {
    account: { id: 1, name: "konto-testowe" } as Account,
    events,
    log: async (action, outcome, _detail, payload) => {
      events.push({ action, outcome, payload });
    },
  };
}

describe("ManualAdapter", () => {
  it("publish zwraca paczkę i loguje zdarzenie — zero żądań sieciowych", async () => {
    const ctx = fakeCtx();
    const result = await new ManualAdapter().publish(PAYLOAD, ctx);
    expect(result.kind).toBe("manual_package");
    if (result.kind === "manual_package") {
      expect(result.pkg.copyBlocks[0]?.value).toBe(PAYLOAD.title);
    }
    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0]?.action).toBe("publish.manual_package");
  });

  it("operacje zdalne są nieobsługiwane z czytelnym powodem", async () => {
    const ctx = fakeCtx();
    const adapter = new ManualAdapter();
    expect((await adapter.fetchListings(ctx)).kind).toBe("unsupported");
    expect((await adapter.fetchStats("x", ctx)).kind).toBe("unsupported");
    expect((await adapter.delete("x", ctx)).kind).toBe("unsupported");
    expect(ctx.events).toHaveLength(0);
  });
});

describe("DryRunAdapter", () => {
  it("publish loguje pełny payload i niczego nie wysyła", async () => {
    const ctx = fakeCtx();
    const result = await new DryRunAdapter().publish(PAYLOAD, ctx);
    expect(result.kind).toBe("logged");
    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0]?.action).toBe("publish.dry_run");
    expect(ctx.events[0]?.payload).toEqual(PAYLOAD);
  });

  it("update i delete również tylko logują", async () => {
    const ctx = fakeCtx();
    const adapter = new DryRunAdapter();
    await adapter.update(PAYLOAD, ctx);
    await adapter.delete("ext-1", ctx);
    expect(ctx.events.map((e) => e.action)).toEqual(["update.dry_run", "delete.dry_run"]);
  });
});

import { DryRunAdapter } from "./dry-run";
import { ManualAdapter } from "./manual";
import type { Account, MarketplaceAdapter } from "./types";

/**
 * Wybór adaptera per konto. Konto z ustawieniem "vinted" do czasu Etapu 8
 * świadomie spada na tryb ręczny — bezpieczny domyślny kierunek.
 */
export function getAdapterForAccount(account: Account): MarketplaceAdapter {
  switch (account.adapter) {
    case "dry_run":
      return new DryRunAdapter();
    case "manual":
    case "vinted":
      return new ManualAdapter();
  }
}

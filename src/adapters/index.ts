import { DryRunAdapter } from "./dry-run";
import { ManualAdapter } from "./manual";
import type { Account, MarketplaceAdapter } from "./types";

/**
 * Wybór adaptera per konto do operacji w przepływie aplikacji.
 *
 * Konto "vinted" świadomie spada na tryb ręczny: realny VintedAdapter jest
 * w pełni zbudowany i przetestowany (src/adapters/vinted), ale jego transport
 * nic nie wysyła (automatyzacja kont prywatnych łamie regulamin Vinted).
 * Adapter uruchamiasz „na sucho" przez diagnostykę w Ustawieniach; realne
 * żądania podłącza się tylko dla oficjalnej ścieżki Vinted Pro, podmieniając
 * DisabledVintedTransport na implementację zgodną z tym programem.
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

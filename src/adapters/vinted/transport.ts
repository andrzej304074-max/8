import type { ListingPayload } from "../types";

/** Wynik pojedynczej operacji transportu (jednej próby sieciowej). */
export type TransportResult =
  | { ok: true; externalId: string | null; views?: number; likes?: number }
  | {
      ok: false;
      status: number | null;
      message: string;
      /** Sesja wygasła — zatrzymaj kolejkę i poproś o odnowienie. */
      sessionExpired?: boolean;
      /** Trwały stan "integracja wyłączona" — nie ponawiaj, nie licz do wyłącznika. */
      disabled?: boolean;
    };

/**
 * Seam realnego wysyłania. To JEDYNE miejsce, które faktycznie rozmawiałoby
 * z platformą. Cała logika bezpieczeństwa (limiter, backoff, wyłącznik,
 * idempotencja, EventLog) żyje w VintedAdapter i jest niezależna od transportu.
 */
export interface VintedTransport {
  readonly name: string;
  publish(payload: ListingPayload, session: string): Promise<TransportResult>;
  update(payload: ListingPayload, session: string): Promise<TransportResult>;
  delete(externalId: string, session: string): Promise<TransportResult>;
  fetchStats(externalId: string, session: string): Promise<TransportResult>;
}

/**
 * Domyślny transport: NIC NIE WYSYŁA. Każda operacja zwraca kontrolowany błąd
 * "integracja wyłączona". Automatyzacja kont prywatnych łamie regulamin Vinted
 * i grozi blokadą — realny transport można podłączyć wyłącznie dla oficjalnej
 * ścieżki (Vinted Pro Integrations), podmieniając tę klasę. Do tego czasu
 * adapter jest w pełni funkcjonalny "na sucho": ćwiczy limiter, backoff i
 * wyłącznik, ale żaden pakiet nie opuszcza serwera.
 */
export class DisabledVintedTransport implements VintedTransport {
  readonly name = "disabled";

  private disabled(): TransportResult {
    return {
      ok: false,
      status: null,
      disabled: true,
      message:
        "Realna integracja z Vinted jest wyłączona (konta prywatne, regulamin platformy). " +
        "Użyj trybu ręcznego lub oficjalnej ścieżki Vinted Pro.",
    };
  }

  async publish(): Promise<TransportResult> {
    return this.disabled();
  }
  async update(): Promise<TransportResult> {
    return this.disabled();
  }
  async delete(): Promise<TransportResult> {
    return this.disabled();
  }
  async fetchStats(): Promise<TransportResult> {
    return this.disabled();
  }
}

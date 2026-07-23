import { backoffDelayMs, isRetryable } from "./backoff";
import { CircuitBreaker } from "./circuit-breaker";
import { TokenBucket } from "./token-bucket";
import { DisabledVintedTransport, type VintedTransport } from "./transport";
import type {
  AdapterContext,
  FetchListingsOutcome,
  FetchStatsOutcome,
  ListingPayload,
  MarketplaceAdapter,
  PublishOutcome,
  SimpleOutcome,
} from "../types";

export interface VintedAdapterConfig {
  /** Pojemność token bucketa (maks. seria żądań). */
  bucketCapacity: number;
  /** Uzupełnianie tokenów na sekundę (konserwatywnie, np. 0.2 = 1 co 5 s). */
  refillPerSecond: number;
  /** Ile prób łącznie na jedną operację (1 = bez ponawiania). */
  maxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  /** Po ilu kolejnych błędach wyłącznik zatrzymuje adapter. */
  breakerThreshold: number;
}

export const DEFAULT_VINTED_CONFIG: VintedAdapterConfig = {
  bucketCapacity: 3,
  refillPerSecond: 0.1, // 1 żądanie co ~10 s — konserwatywnie
  maxAttempts: 4,
  backoffBaseMs: 1000,
  backoffMaxMs: 60_000,
  breakerThreshold: 5,
};

export interface AttemptEnv {
  now: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
}

const REAL_ENV: AttemptEnv = {
  now: () => Date.now(),
  random: () => Math.random(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Wygasła sesja — sygnał dla warstwy wyżej, by zatrzymać kolejkę i poprosić o odnowienie. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Sesja Vinted wygasła — zatrzymano kolejkę, wymagane odnowienie sesji.");
    this.name = "SessionExpiredError";
  }
}

/** Wyłącznik bezpieczeństwa otwarty — adapter zatrzymany do interwencji człowieka. */
export class CircuitOpenError extends Error {
  constructor(lastError: string | null) {
    super(
      `Wyłącznik bezpieczeństwa otwarty po serii błędów (ostatni: ${lastError ?? "?"}). ` +
        "Adapter zatrzymany — wymagana interwencja i reset.",
    );
    this.name = "CircuitOpenError";
  }
}

/**
 * Realny adapter Vinted — pełna warstwa bezpieczeństwa wg specyfikacji:
 * token bucket, wykładniczy backoff z jitterem przy 429/5xx, wyłącznik po N
 * kolejnych błędach (bez auto-recovery), idempotencja, pełny EventLog przed i
 * po operacji, jawne wykrywanie wygasłej sesji.
 *
 * Domyślnie działa z DisabledVintedTransport — cała maszyneria się kręci, ale
 * żaden pakiet nie opuszcza serwera. Realny transport podłącza się tylko dla
 * oficjalnej ścieżki (Vinted Pro).
 */
export class VintedAdapter implements MarketplaceAdapter {
  readonly name = "vinted";
  private readonly bucket: TokenBucket;
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly transport: VintedTransport = new DisabledVintedTransport(),
    private readonly config: VintedAdapterConfig = DEFAULT_VINTED_CONFIG,
    private readonly session: string | null = null,
    private readonly env: AttemptEnv = REAL_ENV,
  ) {
    this.bucket = new TokenBucket(config.bucketCapacity, config.refillPerSecond, env.now());
    this.breaker = new CircuitBreaker(config.breakerThreshold);
  }

  breakerSnapshot() {
    return this.breaker.snapshot();
  }

  resetBreaker(): void {
    this.breaker.reset();
  }

  /**
   * Wspólny rdzeń każdej operacji: sprawdza wyłącznik, czeka na token,
   * loguje przed/po, ponawia z backoffem, aktualizuje wyłącznik, wykrywa
   * wygasłą sesję. `idempotencyResolved` pozwala pominąć operację, jeśli już
   * się powiodła (ponowienie po awarii nie tworzy duplikatu).
   */
  private async run(
    action: string,
    ctx: AdapterContext,
    attemptOnce: (session: string) => Promise<import("./transport").TransportResult>,
    opts: { alreadyDoneExternalId?: string | null } = {},
  ): Promise<
    | { ok: true; externalId: string | null; views?: number; likes?: number }
    | { ok: false; reason: string }
  > {
    // Idempotencja: jeśli operacja już ma wynik (external_id), nie powtarzamy.
    if (opts.alreadyDoneExternalId) {
      await ctx.log(
        `${action}.skipped_idempotent`,
        "ok",
        `Pominięto — operacja już wykonana (ext: ${opts.alreadyDoneExternalId})`,
      );
      return { ok: true, externalId: opts.alreadyDoneExternalId };
    }

    if (!this.breaker.canProceed()) {
      const snap = this.breaker.snapshot();
      await ctx.log(`${action}.blocked_circuit_open`, "error", snap.lastError ?? "wyłącznik otwarty");
      throw new CircuitOpenError(snap.lastError);
    }

    if (this.session === null) {
      await ctx.log(`${action}.no_session`, "error", "Brak sesji konta — najpierw odnów sesję.");
      throw new SessionExpiredError();
    }

    await ctx.log(`${action}.attempt`, "ok", "Rozpoczęto operację (przed wysłaniem)");

    let lastMessage = "nieznany błąd";
    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      // Limiter: czekamy na token, zamiast przepychać się ponad limit.
      const wait = this.bucket.msUntilAvailable(this.env.now());
      if (wait > 0) await this.env.sleep(wait);
      this.bucket.tryRemove(this.env.now());

      const result = await attemptOnce(this.session);

      // "Integracja wyłączona" to stan trwały, nie przejściowy błąd —
      // zwracamy od razu, bez ponawiania i bez ruszania wyłącznika.
      if (!result.ok && result.disabled) {
        await ctx.log(`${action}.disabled`, "error", result.message);
        return { ok: false, reason: result.message };
      }

      if (result.ok) {
        this.breaker.recordSuccess();
        await ctx.log(
          `${action}.ok`,
          "ok",
          `Operacja powiodła się${result.externalId ? ` (ext: ${result.externalId})` : ""}`,
        );
        return {
          ok: true,
          externalId: result.externalId,
          views: result.views,
          likes: result.likes,
        };
      }

      lastMessage = result.message;

      // Wygasła sesja: przerywamy natychmiast, sygnalizujemy wyżej.
      if (result.sessionExpired) {
        this.breaker.recordFailure("sesja wygasła", () => new Date().toISOString());
        await ctx.log(`${action}.session_expired`, "error", result.message);
        throw new SessionExpiredError();
      }

      const opened = this.breaker.recordFailure(result.message, () => new Date().toISOString());
      await ctx.log(
        `${action}.error`,
        "error",
        `Próba ${attempt + 1}/${this.config.maxAttempts}: ${result.message}`,
        { status: result.status },
      );

      if (opened) {
        await ctx.log(`${action}.circuit_opened`, "error", "Wyłącznik bezpieczeństwa otwarty — zatrzymano.");
        throw new CircuitOpenError(result.message);
      }

      // Nieponawialny błąd (np. 400/403) — nie ma sensu próbować dalej.
      if (!isRetryable(result.status)) break;

      // Ostatnia próba — nie śpimy już po niej.
      if (attempt < this.config.maxAttempts - 1) {
        const delay = backoffDelayMs(attempt, {
          baseMs: this.config.backoffBaseMs,
          maxMs: this.config.backoffMaxMs,
          random: this.env.random,
        });
        await this.env.sleep(delay);
      }
    }

    await ctx.log(`${action}.failed`, "error", `Wyczerpano próby: ${lastMessage}`);
    return { ok: false, reason: lastMessage };
  }

  async publish(payload: ListingPayload, ctx: AdapterContext): Promise<PublishOutcome> {
    const result = await this.run(
      "publish",
      ctx,
      (session) => this.transport.publish(payload, session),
    );
    if (result.ok) return { kind: "published", externalId: result.externalId };
    return { kind: "unsupported", reason: result.reason };
  }

  async update(payload: ListingPayload, ctx: AdapterContext): Promise<SimpleOutcome> {
    const result = await this.run(
      "update",
      ctx,
      (session) => this.transport.update(payload, session),
    );
    return result.ok ? { kind: "done" } : { kind: "unsupported", reason: result.reason };
  }

  async delete(externalId: string, ctx: AdapterContext): Promise<SimpleOutcome> {
    const result = await this.run(
      "delete",
      ctx,
      (session) => this.transport.delete(externalId, session),
    );
    return result.ok ? { kind: "done" } : { kind: "unsupported", reason: result.reason };
  }

  async fetchListings(_ctx: AdapterContext): Promise<FetchListingsOutcome> {
    return {
      kind: "unsupported",
      reason: "Pobieranie listy ogłoszeń nie jest zaimplementowane (integracja wyłączona).",
    };
  }

  async fetchStats(externalId: string, ctx: AdapterContext): Promise<FetchStatsOutcome> {
    const result = await this.run(
      "fetch_stats",
      ctx,
      (session) => this.transport.fetchStats(externalId, session),
    );
    if (result.ok) {
      return { kind: "stats", views: result.views ?? 0, likes: result.likes ?? 0 };
    }
    return { kind: "unsupported", reason: result.reason };
  }

  async sendMessage(): Promise<SimpleOutcome> {
    return {
      kind: "unsupported",
      reason: "Wysyłanie wiadomości nie jest zaimplementowane (integracja wyłączona).",
    };
  }
}

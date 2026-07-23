export type BreakerState = "closed" | "open";

/**
 * Wyłącznik bezpieczeństwa. Po N kolejnych błędach przechodzi w stan "open"
 * i CAŁKOWICIE zatrzymuje adapter — zgodnie ze specyfikacją nie próbuje się
 * "przepchnąć" dalej. Powrót do pracy wymaga jawnego resetu przez człowieka
 * (brak auto-recovery / half-open).
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private state: BreakerState = "closed";
  private lastError: string | null = null;
  private trippedAt: string | null = null;

  constructor(private readonly threshold: number) {}

  canProceed(): boolean {
    return this.state === "closed";
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.lastError = null;
  }

  /** Zwraca true, jeśli ten błąd właśnie otworzył wyłącznik. */
  recordFailure(error: string, now: () => string = () => new Date().toISOString()): boolean {
    this.consecutiveFailures += 1;
    this.lastError = error;
    if (this.state === "closed" && this.consecutiveFailures >= this.threshold) {
      this.state = "open";
      this.trippedAt = now();
      return true;
    }
    return false;
  }

  /** Jawny reset po interwencji człowieka. */
  reset(): void {
    this.consecutiveFailures = 0;
    this.state = "closed";
    this.lastError = null;
    this.trippedAt = null;
  }

  snapshot(): {
    state: BreakerState;
    consecutiveFailures: number;
    lastError: string | null;
    trippedAt: string | null;
  } {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
      trippedAt: this.trippedAt,
    };
  }
}

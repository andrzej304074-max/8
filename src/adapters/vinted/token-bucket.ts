/**
 * Token bucket — limiter wychodzących żądań. Konserwatywny domyślnie,
 * konfigurowalny per konto. Czysty i deterministyczny: czas podajemy z zewnątrz.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: number = Date.now(),
  ) {
    this.tokens = capacity;
    this.lastRefill = now;
  }

  private refill(now: number): void {
    const elapsedSec = Math.max(0, (now - this.lastRefill) / 1000);
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSecond);
    this.lastRefill = now;
  }

  /** Próbuje pobrać token; true = można wysłać, false = limit wyczerpany. */
  tryRemove(now: number = Date.now(), count = 1): boolean {
    this.refill(now);
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  /** Ile ms trzeba odczekać, aż będzie dostępny token (0 = od razu). */
  msUntilAvailable(now: number = Date.now(), count = 1): number {
    this.refill(now);
    if (this.tokens >= count) return 0;
    const deficit = count - this.tokens;
    return Math.ceil((deficit / this.refillPerSecond) * 1000);
  }

  availableTokens(now: number = Date.now()): number {
    this.refill(now);
    return this.tokens;
  }
}

export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
  /** Źródło losowości 0..1 — wstrzykiwane dla testowalności. */
  random?: () => number;
}

/**
 * Wykładniczy backoff z pełnym jitterem. attempt liczony od 0.
 * Opóźnienie ∈ [0, min(maxMs, baseMs * 2^attempt)] — jitter rozkłada retry,
 * żeby po błędzie 429/5xx nie uderzać w tej samej sekundzie.
 */
export function backoffDelayMs(attempt: number, opts: BackoffOptions): number {
  const random = opts.random ?? Math.random;
  const exponential = Math.min(opts.maxMs, opts.baseMs * 2 ** attempt);
  return Math.round(random() * exponential);
}

/** Czy błąd o danym statusie HTTP kwalifikuje się do ponowienia. */
export function isRetryable(status: number | null): boolean {
  if (status === null) return true; // błąd sieci — ponawialny
  if (status === 429) return true; // rate limit
  return status >= 500 && status < 600; // błędy serwera
}

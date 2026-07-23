import { describe, expect, it } from "vitest";
import { backoffDelayMs, isRetryable } from "./backoff";
import { CircuitBreaker } from "./circuit-breaker";
import { TokenBucket } from "./token-bucket";

describe("TokenBucket", () => {
  it("startuje pełny i pozwala do wyczerpania pojemności", () => {
    const b = new TokenBucket(3, 1, 0);
    expect(b.tryRemove(0)).toBe(true);
    expect(b.tryRemove(0)).toBe(true);
    expect(b.tryRemove(0)).toBe(true);
    expect(b.tryRemove(0)).toBe(false); // wyczerpany
  });

  it("uzupełnia się w czasie wg refillPerSecond", () => {
    const b = new TokenBucket(2, 1, 0);
    b.tryRemove(0);
    b.tryRemove(0);
    expect(b.tryRemove(0)).toBe(false);
    expect(b.tryRemove(1000)).toBe(true); // po 1 s jeden token wrócił
  });

  it("nie przekracza pojemności przy uzupełnianiu", () => {
    const b = new TokenBucket(2, 10, 0);
    expect(b.availableTokens(10_000)).toBe(2);
  });

  it("msUntilAvailable liczy czas oczekiwania", () => {
    const b = new TokenBucket(1, 1, 0);
    b.tryRemove(0);
    expect(b.msUntilAvailable(0)).toBe(1000);
    expect(b.msUntilAvailable(500)).toBe(500);
  });
});

describe("backoffDelayMs", () => {
  it("rośnie wykładniczo (górna granica przed jitterem)", () => {
    const max = (attempt: number) =>
      backoffDelayMs(attempt, { baseMs: 100, maxMs: 100_000, random: () => 1 });
    expect(max(0)).toBe(100);
    expect(max(1)).toBe(200);
    expect(max(2)).toBe(400);
    expect(max(3)).toBe(800);
  });

  it("respektuje maxMs", () => {
    expect(backoffDelayMs(20, { baseMs: 100, maxMs: 5000, random: () => 1 })).toBe(5000);
  });

  it("pełny jitter: przy random=0 opóźnienie zerowe", () => {
    expect(backoffDelayMs(5, { baseMs: 100, maxMs: 100_000, random: () => 0 })).toBe(0);
  });

  it("jitter mieści się w [0, granica]", () => {
    const d = backoffDelayMs(3, { baseMs: 100, maxMs: 100_000, random: () => 0.5 });
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(800);
  });
});

describe("isRetryable", () => {
  it("429, 5xx i błąd sieci (null) są ponawialne", () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(null)).toBe(true);
  });

  it("4xx (poza 429) nie są ponawialne", () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(403)).toBe(false);
  });
});

describe("CircuitBreaker", () => {
  it("otwiera się po N kolejnych błędach", () => {
    const cb = new CircuitBreaker(3);
    expect(cb.canProceed()).toBe(true);
    expect(cb.recordFailure("e1")).toBe(false);
    expect(cb.recordFailure("e2")).toBe(false);
    expect(cb.recordFailure("e3")).toBe(true); // trzeci błąd otwiera
    expect(cb.canProceed()).toBe(false);
  });

  it("sukces zeruje licznik kolejnych błędów", () => {
    const cb = new CircuitBreaker(3);
    cb.recordFailure("e1");
    cb.recordFailure("e2");
    cb.recordSuccess();
    cb.recordFailure("e3");
    cb.recordFailure("e4");
    expect(cb.canProceed()).toBe(true); // dopiero 2 z rzędu po sukcesie
  });

  it("po otwarciu wymaga jawnego resetu — nie wraca sam", () => {
    const cb = new CircuitBreaker(1);
    cb.recordFailure("boom");
    expect(cb.canProceed()).toBe(false);
    cb.reset();
    expect(cb.canProceed()).toBe(true);
    expect(cb.snapshot().consecutiveFailures).toBe(0);
  });

  it("snapshot zawiera stan i ostatni błąd", () => {
    const cb = new CircuitBreaker(1);
    cb.recordFailure("wygasła sesja", () => "2026-07-23T12:00:00Z");
    const snap = cb.snapshot();
    expect(snap.state).toBe("open");
    expect(snap.lastError).toBe("wygasła sesja");
    expect(snap.trippedAt).toBe("2026-07-23T12:00:00Z");
  });
});

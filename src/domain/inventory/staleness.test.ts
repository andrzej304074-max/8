import { describe, expect, it } from "vitest";
import { daysInStock, suggestAction } from "./staleness";

describe("daysInStock", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("liczy pełne dni od dodania", () => {
    expect(daysInStock("2026-07-23T08:00:00Z", now)).toBe(0);
    expect(daysInStock("2026-07-22T12:00:00Z", now)).toBe(1);
    expect(daysInStock("2026-06-23T12:00:00Z", now)).toBe(30);
  });

  it("nie zwraca wartości ujemnych dla dat z przyszłości", () => {
    expect(daysInStock("2026-07-24T12:00:00Z", now)).toBe(0);
  });
});

describe("suggestAction", () => {
  it("poniżej 7 dni nie sugeruje niczego", () => {
    expect(suggestAction(0)).toBeNull();
    expect(suggestAction(6)).toBeNull();
  });

  it("eskaluje na progach 7 / 21 / 45 / 90 dni", () => {
    expect(suggestAction(7)?.action).toBe("odswiez");
    expect(suggestAction(20)?.action).toBe("odswiez");
    expect(suggestAction(21)?.action).toBe("obniz_cene");
    expect(suggestAction(44)?.action).toBe("obniz_cene");
    expect(suggestAction(45)?.action).toBe("przenies");
    expect(suggestAction(89)?.action).toBe("przenies");
    expect(suggestAction(90)?.action).toBe("wycofaj");
    expect(suggestAction(365)?.action).toBe("wycofaj");
  });
});

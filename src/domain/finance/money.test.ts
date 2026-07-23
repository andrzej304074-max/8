import { describe, expect, it } from "vitest";
import { formatPln, parsePlnToGrosze } from "./money";

// Intl dla pl-PL wstawia spacje niełamliwe (U+00A0/U+202F) — normalizujemy przed porównaniem.
const plain = (s: string) => s.replace(/[\u00A0\u202F]/g, " ");

describe("formatPln", () => {
  it("formatuje grosze jako złotówki", () => {
    expect(plain(formatPln(1250))).toBe("12,50 zł");
    expect(plain(formatPln(0))).toBe("0,00 zł");
  });

  it("grupuje tysiące od 5 cyfr (polskie reguły CLDR)", () => {
    expect(plain(formatPln(125000))).toBe("1250,00 zł");
    expect(plain(formatPln(1250000))).toBe("12 500,00 zł");
  });

  it("odrzuca kwoty niecałkowite", () => {
    expect(() => formatPln(12.5)).toThrow();
  });
});

describe("parsePlnToGrosze", () => {
  it("parsuje pełne złotówki", () => {
    expect(parsePlnToGrosze("12")).toBe(1200);
  });

  it("parsuje przecinek i kropkę", () => {
    expect(parsePlnToGrosze("12,50")).toBe(1250);
    expect(parsePlnToGrosze("12.50")).toBe(1250);
  });

  it("parsuje pojedynczą cyfrę groszy jako dziesiątki", () => {
    expect(parsePlnToGrosze("12,5")).toBe(1250);
  });

  it("ignoruje spacje w tysiącach", () => {
    expect(parsePlnToGrosze("1 250,00")).toBe(125000);
  });

  it("odrzuca wartości nieprawidłowe", () => {
    expect(parsePlnToGrosze("")).toBeNull();
    expect(parsePlnToGrosze("abc")).toBeNull();
    expect(parsePlnToGrosze("-5")).toBeNull();
    expect(parsePlnToGrosze("12,505")).toBeNull();
    expect(parsePlnToGrosze("12,50 zł")).toBeNull();
  });
});

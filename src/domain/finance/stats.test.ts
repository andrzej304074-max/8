import { describe, expect, it } from "vitest";
import {
  computeMarginGr,
  groupBy,
  inventoryRotation,
  monthKey,
  summarize,
  type SaleRecord,
} from "./stats";

describe("computeMarginGr", () => {
  it("odejmuje prowizję, wysyłkę i cenę zakupu", () => {
    expect(
      computeMarginGr({
        finalPriceGr: 5000,
        commissionGr: 250,
        shippingGr: 0,
        purchasePriceGr: 1500,
      }),
    ).toBe(3250);
  });

  it("traktuje brak ceny zakupu jako zero", () => {
    expect(
      computeMarginGr({ finalPriceGr: 5000, commissionGr: 0, shippingGr: 0, purchasePriceGr: null }),
    ).toBe(5000);
  });

  it("marża może być ujemna (sprzedaż poniżej kosztów)", () => {
    expect(
      computeMarginGr({ finalPriceGr: 1000, commissionGr: 100, shippingGr: 0, purchasePriceGr: 1500 }),
    ).toBe(-600);
  });
});

function sale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    finalPriceGr: 5000,
    commissionGr: 0,
    shippingGr: 0,
    marginGr: 3500,
    soldAt: "2026-07-20T10:00:00Z",
    publishedAt: "2026-07-10T10:00:00Z",
    category: "Swetry",
    brand: "H&M",
    ...overrides,
  };
}

describe("summarize", () => {
  it("sumuje przychód i marżę, liczy średni czas do sprzedaży", () => {
    const result = summarize([
      sale({ finalPriceGr: 5000, marginGr: 3500, publishedAt: "2026-07-10T00:00:00Z", soldAt: "2026-07-20T00:00:00Z" }),
      sale({ finalPriceGr: 3000, marginGr: 1000, publishedAt: "2026-07-01T00:00:00Z", soldAt: "2026-07-05T00:00:00Z" }),
    ]);
    expect(result.count).toBe(2);
    expect(result.revenueGr).toBe(8000);
    expect(result.marginGr).toBe(4500);
    expect(result.avgDaysToSale).toBe(7); // (10 + 4) / 2
  });

  it("pomija czas do sprzedaży bez daty publikacji", () => {
    const result = summarize([sale({ publishedAt: null })]);
    expect(result.avgDaysToSale).toBeNull();
  });

  it("pusta lista daje zera", () => {
    expect(summarize([])).toEqual({ count: 0, revenueGr: 0, marginGr: 0, avgDaysToSale: null });
  });
});

describe("groupBy", () => {
  it("grupuje po marce i sortuje po marży malejąco", () => {
    const groups = groupBy(
      [
        sale({ brand: "Nike", marginGr: 2000 }),
        sale({ brand: "H&M", marginGr: 500 }),
        sale({ brand: "Nike", marginGr: 3000 }),
      ],
      "brand",
    );
    expect(groups[0]?.key).toBe("Nike");
    expect(groups[0]?.count).toBe(2);
    expect(groups[0]?.marginGr).toBe(5000);
    expect(groups[1]?.key).toBe("H&M");
  });

  it("brak wartości grupuje jako (brak)", () => {
    const groups = groupBy([sale({ category: null })], "category");
    expect(groups[0]?.key).toBe("(brak)");
  });
});

describe("inventoryRotation", () => {
  it("zwraca udział sprzedanych", () => {
    expect(inventoryRotation(3, 1)).toBe(0.75);
    expect(inventoryRotation(0, 0)).toBe(0);
  });
});

describe("monthKey", () => {
  it("wycina YYYY-MM", () => {
    expect(monthKey("2026-07-20T10:00:00Z")).toBe("2026-07");
  });
});

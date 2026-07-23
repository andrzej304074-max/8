import { describe, expect, it } from "vitest";
import { evaluateRule, matchConditions } from "./engine";
import type { RuleAction, RuleConditions, RuleContext } from "./types";

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    listingId: 1,
    itemId: 1,
    itemName: "Sweter",
    status: "published",
    priceGr: 5000,
    views: 3,
    likes: 0,
    daysListed: 10,
    daysInStock: 12,
    priorExecutions: 0,
    ...overrides,
  };
}

describe("matchConditions", () => {
  const listedOver7: RuleConditions = {
    match: "all",
    clauses: [{ field: "days_listed", op: "gt", value: 7 }],
  };

  it("all: wszystkie warunki muszą pasować", () => {
    const cond: RuleConditions = {
      match: "all",
      clauses: [
        { field: "days_listed", op: "gt", value: 7 },
        { field: "views", op: "lt", value: 5 },
      ],
    };
    expect(matchConditions(cond, ctx({ daysListed: 10, views: 3 }))).toBe(true);
    expect(matchConditions(cond, ctx({ daysListed: 10, views: 8 }))).toBe(false);
  });

  it("any: wystarczy jeden warunek", () => {
    const cond: RuleConditions = {
      match: "any",
      clauses: [
        { field: "days_listed", op: "gt", value: 30 },
        { field: "views", op: "lt", value: 5 },
      ],
    };
    expect(matchConditions(cond, ctx({ daysListed: 10, views: 3 }))).toBe(true);
    expect(matchConditions(cond, ctx({ daysListed: 10, views: 8 }))).toBe(false);
  });

  it("porównania tekstowe tylko eq/neq (status)", () => {
    const cond: RuleConditions = {
      match: "all",
      clauses: [{ field: "status", op: "eq", value: "published" }],
    };
    expect(matchConditions(cond, ctx({ status: "published" }))).toBe(true);
    expect(matchConditions(cond, ctx({ status: "sold" }))).toBe(false);
  });

  it("null (brak ceny) nigdy nie spełnia warunku liczbowego", () => {
    const cond: RuleConditions = {
      match: "all",
      clauses: [{ field: "price_gr", op: "gt", value: 100 }],
    };
    expect(matchConditions(cond, ctx({ priceGr: null }))).toBe(false);
  });

  it("wszystkie operatory liczbowe", () => {
    const mk = (op: RuleConditions["clauses"][number]["op"], value: number): RuleConditions => ({
      match: "all",
      clauses: [{ field: "views", op, value }],
    });
    expect(matchConditions(mk("gt", 2), ctx({ views: 3 }))).toBe(true);
    expect(matchConditions(mk("gte", 3), ctx({ views: 3 }))).toBe(true);
    expect(matchConditions(mk("lt", 4), ctx({ views: 3 }))).toBe(true);
    expect(matchConditions(mk("lte", 3), ctx({ views: 3 }))).toBe(true);
    expect(matchConditions(mk("eq", 3), ctx({ views: 3 }))).toBe(true);
    expect(matchConditions(mk("neq", 4), ctx({ views: 3 }))).toBe(true);
  });
});

describe("evaluateRule — price_drop", () => {
  const cond: RuleConditions = {
    match: "all",
    clauses: [{ field: "days_listed", op: "gt", value: 21 }],
  };
  const action: RuleAction = {
    type: "price_drop",
    percent: 10,
    min_price_gr: 2000,
    max_per_item: 3,
  };

  it("obniża cenę o procent, zaokrąglając do grosza", () => {
    const result = evaluateRule(cond, action, ctx({ daysListed: 22, priceGr: 5000 }));
    expect(result.effect).toEqual({ type: "price_drop", oldPriceGr: 5000, newPriceGr: 4500 });
  });

  it("nie schodzi poniżej progu minimalnego", () => {
    const result = evaluateRule(cond, action, ctx({ daysListed: 22, priceGr: 2100 }));
    // 2100 * 0.9 = 1890, ale próg to 2000 → i tak >= 2100? nie, 2000 < 2100, więc drop do 2000
    expect(result.effect).toEqual({ type: "price_drop", oldPriceGr: 2100, newPriceGr: 2000 });
  });

  it("blokuje, gdy cena już na progu minimalnym", () => {
    const result = evaluateRule(cond, action, ctx({ daysListed: 22, priceGr: 2000 }));
    expect(result.effect).toBeNull();
    expect(result.blockedReason).toContain("progu minimalnym");
  });

  it("respektuje limit obniżek per przedmiot", () => {
    const result = evaluateRule(
      cond,
      action,
      ctx({ daysListed: 22, priceGr: 5000, priorExecutions: 3 }),
    );
    expect(result.effect).toBeNull();
    expect(result.blockedReason).toContain("limit obniżek");
  });

  it("nie działa, gdy warunki niespełnione", () => {
    const result = evaluateRule(cond, action, ctx({ daysListed: 5 }));
    expect(result.matches).toBe(false);
    expect(result.effect).toBeNull();
  });
});

describe("evaluateRule — relist i refresh", () => {
  const cond: RuleConditions = {
    match: "all",
    clauses: [
      { field: "days_listed", op: "gt", value: 7 },
      { field: "status", op: "eq", value: "published" },
    ],
  };

  it("relist zwraca efekt relist przy dopasowaniu", () => {
    const result = evaluateRule(cond, { type: "relist" }, ctx({ daysListed: 10 }));
    expect(result.effect).toEqual({ type: "relist" });
  });

  it("refresh zwraca efekt refresh przy dopasowaniu", () => {
    const result = evaluateRule(cond, { type: "refresh" }, ctx({ daysListed: 10 }));
    expect(result.effect).toEqual({ type: "refresh" });
  });
});

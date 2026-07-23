import { describe, expect, it } from "vitest";
import { groszeToCsvNumber, toCsv } from "./csv";

describe("toCsv", () => {
  it("zaczyna się od BOM i używa średnika", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("a;b");
    expect(csv).toContain("1;2");
  });

  it("cytuje komórki ze średnikiem, cudzysłowem i nową linią", () => {
    const csv = toCsv(["x"], [['ma;średnik'], ['ma "cudzysłów"'], ["ma\nnową linię"]]);
    expect(csv).toContain('"ma;średnik"');
    expect(csv).toContain('"ma ""cudzysłów"""');
    expect(csv).toContain('"ma\nnową linię"');
  });

  it("null → pusta komórka", () => {
    expect(toCsv(["x"], [[null]])).toContain("﻿x\r\n");
  });
});

describe("groszeToCsvNumber", () => {
  it("formatuje z przecinkiem dziesiętnym", () => {
    expect(groszeToCsvNumber(4500)).toBe("45,00");
    expect(groszeToCsvNumber(0)).toBe("0,00");
    expect(groszeToCsvNumber(null)).toBe("");
  });
});

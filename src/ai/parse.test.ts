import { describe, expect, it } from "vitest";
import { parseAiResponse } from "./parse";
import type { AiListing } from "./schema";

const VALID: AiListing = {
  title: "Sweter wełniany H&M szary M",
  description: "Ciepły sweter z wełny. Stan bardzo dobry, bez śladów użytkowania.",
  brand: "H&M",
  brand_confidence: "high",
  category_path: ["Kobiety", "Odzież", "Swetry"],
  size: "M",
  condition: "bardzo dobry",
  color: ["szary"],
  material: "wełna",
  measurements_needed: ["długość", "szerokość w klatce"],
  suggested_price_pln: 45,
  price_reasoning: "Typowa cena wełnianych swetrów sieciówek w bardzo dobrym stanie.",
  flags: [],
};

describe("parseAiResponse", () => {
  it("akceptuje czysty JSON", () => {
    const result = parseAiResponse(JSON.stringify(VALID));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.brand).toBe("H&M");
  });

  it("radzi sobie z blokiem markdown i preambułą mimo zakazu", () => {
    const raw = "Oto odpowiedź:\n```json\n" + JSON.stringify(VALID) + "\n```\nKoniec.";
    const result = parseAiResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("odrzuca odpowiedź niebędącą JSON", () => {
    const result = parseAiResponse("to nie jest json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON");
  });

  it("odrzuca tytuł dłuższy niż 60 znaków", () => {
    const result = parseAiResponse(
      JSON.stringify({ ...VALID, title: "x".repeat(61) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("title");
  });

  it("odrzuca nieznaną wartość brand_confidence i condition", () => {
    expect(
      parseAiResponse(JSON.stringify({ ...VALID, brand_confidence: "pewny" })).ok,
    ).toBe(false);
    expect(
      parseAiResponse(JSON.stringify({ ...VALID, condition: "super" })).ok,
    ).toBe(false);
  });

  it("akceptuje brand null (zakaz zmyślania marki)", () => {
    const result = parseAiResponse(
      JSON.stringify({ ...VALID, brand: null, brand_confidence: "low" }),
    );
    expect(result.ok).toBe(true);
  });
});

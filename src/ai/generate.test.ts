import { describe, expect, it } from "vitest";
import { AiValidationError, runGeneration } from "./generate";
import type { PhotoInput, VisionProvider } from "./provider";
import type { AiListing } from "./schema";

const VALID: AiListing = {
  title: "Kurtka jeansowa niebieska L",
  description: "Klasyczna kurtka jeansowa. Stan dobry, delikatne przetarcia.",
  brand: null,
  brand_confidence: "low",
  category_path: ["Kobiety", "Odzież", "Kurtki"],
  size: "L",
  condition: "dobry",
  color: ["niebieski"],
  material: null,
  measurements_needed: ["długość rękawa"],
  suggested_price_pln: 35,
  price_reasoning: "Cena rynkowa kurtek jeansowych bez marki.",
  flags: ["widoczne przetarcie na lewym rękawie"],
};

function fakeProvider(responses: string[]): VisionProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: "fake",
    calls,
    async generate(_photos: PhotoInput[], instruction: string) {
      calls.push(instruction);
      const next = responses.shift();
      if (next === undefined) throw new Error("brak przygotowanej odpowiedzi");
      return next;
    },
  };
}

const PHOTOS: PhotoInput[] = [{ data: Buffer.from("x"), mimeType: "image/jpeg" }];

describe("runGeneration", () => {
  it("zwraca dane przy poprawnej pierwszej odpowiedzi", async () => {
    const provider = fakeProvider([JSON.stringify(VALID)]);
    const result = await runGeneration(provider, PHOTOS);
    expect(result.title).toBe(VALID.title);
    expect(provider.calls).toHaveLength(1);
  });

  it("ponawia raz z komunikatem błędu walidacji", async () => {
    const provider = fakeProvider(["nie-json", JSON.stringify(VALID)]);
    const result = await runGeneration(provider, PHOTOS);
    expect(result.condition).toBe("dobry");
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]).toContain("NIE przeszła walidacji");
  });

  it("po dwóch nieudanych próbach rzuca AiValidationError", async () => {
    const provider = fakeProvider(["złe", "nadal złe"]);
    await expect(runGeneration(provider, PHOTOS)).rejects.toBeInstanceOf(
      AiValidationError,
    );
    expect(provider.calls).toHaveLength(2);
  });

  it("odmawia generowania bez zdjęć", async () => {
    const provider = fakeProvider([]);
    await expect(runGeneration(provider, [])).rejects.toThrow("nie ma zdjęć");
  });
});

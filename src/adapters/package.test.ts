import { describe, expect, it } from "vitest";
import { buildManualPackage } from "./package";
import type { ListingPayload } from "./types";

const FULL: ListingPayload = {
  listingId: 1,
  itemId: 1,
  title: "Sweter wełniany H&M szary M",
  description: "Ciepły sweter. Stan bardzo dobry.",
  priceGr: 4500,
  categoryPath: ["Kobiety", "Odzież", "Swetry"],
  condition: "bardzo dobry",
  size: "M",
  brand: "H&M",
  colors: ["szary"],
  material: "wełna",
  photoUrls: ["/api/photos/items/1/a-web.jpg"],
};

describe("buildManualPackage", () => {
  it("buduje bloki do skopiowania: tytuł, opis, cena w złotówkach", () => {
    const pkg = buildManualPackage(FULL);
    const labels = pkg.copyBlocks.map((b) => b.label);
    expect(labels).toEqual(["Tytuł", "Opis", "Cena (zł)"]);
    expect(pkg.copyBlocks[2]?.value).toBe("45,00");
  });

  it("buduje checklistę pól z kategorią jako ścieżką", () => {
    const pkg = buildManualPackage(FULL);
    const category = pkg.checklist.find((c) => c.label === "Kategoria");
    expect(category?.value).toBe("Kobiety → Odzież → Swetry");
    expect(pkg.warnings).toHaveLength(0);
  });

  it("ostrzega o brakach: zdjęcia, cena, kategoria, stan", () => {
    const pkg = buildManualPackage({
      ...FULL,
      photoUrls: [],
      priceGr: null,
      categoryPath: [],
      condition: null,
    });
    expect(pkg.warnings.join(" ")).toContain("zdjęć");
    expect(pkg.warnings.join(" ")).toContain("ceny");
    expect(pkg.warnings.join(" ")).toContain("kategorii");
    expect(pkg.warnings.join(" ")).toContain("stanu");
  });

  it("dołącza przekazane ostrzeżenia (np. flagi AI)", () => {
    const pkg = buildManualPackage(FULL, ["widoczna plama na zdjęciu 2"]);
    expect(pkg.warnings).toContain("widoczna plama na zdjęciu 2");
  });
});

import { groszeToInputValue } from "@/domain/finance/money";
import type { ListingPayload, ManualPackage } from "./types";

/**
 * Buduje paczkę do ręcznego wklejenia. Czysta funkcja — używa jej ManualAdapter
 * i strona ogłoszenia (podgląd bez logowania zdarzeń).
 */
export function buildManualPackage(
  payload: ListingPayload,
  extraWarnings: string[] = [],
): ManualPackage {
  const warnings: string[] = [...extraWarnings];
  if (payload.photoUrls.length === 0) {
    warnings.push("Brak zdjęć — ogłoszenie bez zdjęć nie ma szans na sprzedaż.");
  }
  if (payload.priceGr === null) {
    warnings.push("Brak ceny — ustal cenę przed publikacją.");
  }
  if (payload.categoryPath.length === 0) {
    warnings.push("Brak kategorii — wybierz ją ręcznie w formularzu platformy.");
  }
  if (payload.condition === null) {
    warnings.push("Brak stanu przedmiotu — platforma wymaga tego pola.");
  }
  if (payload.title.length > 60) {
    warnings.push("Tytuł przekracza 60 znaków — skróć go przed wklejeniem.");
  }

  return {
    copyBlocks: [
      { label: "Tytuł", value: payload.title },
      { label: "Opis", value: payload.description },
      {
        label: "Cena (zł)",
        value: payload.priceGr !== null ? groszeToInputValue(payload.priceGr) : "",
      },
    ],
    checklist: [
      {
        label: "Kategoria",
        value: payload.categoryPath.length > 0 ? payload.categoryPath.join(" → ") : null,
      },
      { label: "Marka", value: payload.brand },
      { label: "Stan", value: payload.condition },
      { label: "Rozmiar", value: payload.size },
      {
        label: "Kolor",
        value: payload.colors.length > 0 ? payload.colors.join(", ") : null,
      },
      { label: "Materiał", value: payload.material },
    ],
    photoUrls: payload.photoUrls,
    warnings,
  };
}

// Logika widoku „leżą najdłużej": ile dni przedmiot jest w magazynie
// i jaką akcję zasugerować. Czysta funkcja — bez bazy, bez frameworka.

export type StaleAction = "odswiez" | "obniz_cene" | "przenies" | "wycofaj";

export interface StaleSuggestion {
  action: StaleAction;
  label: string;
}

export function daysInStock(createdAtIso: string, now: Date = new Date()): number {
  const created = new Date(createdAtIso).getTime();
  return Math.max(0, Math.floor((now.getTime() - created) / 86_400_000));
}

// Progi to eskalacja od najtańszej interwencji (odświeżenie) do najdroższej (wycofanie);
// wartości startowe do skorygowania, gdy statystyki z Etapu 7 pokażą realne rotacje.
export function suggestAction(days: number): StaleSuggestion | null {
  if (days >= 90) {
    return { action: "wycofaj", label: "Wycofaj lub przeceń mocno" };
  }
  if (days >= 45) {
    return { action: "przenies", label: "Przenieś na inne konto" };
  }
  if (days >= 21) {
    return { action: "obniz_cene", label: "Obniż cenę" };
  }
  if (days >= 7) {
    return { action: "odswiez", label: "Odśwież ogłoszenie" };
  }
  return null;
}

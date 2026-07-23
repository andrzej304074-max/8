// Wszystkie kwoty w aplikacji to grosze (integer) — te funkcje są jedynym
// miejscem konwersji na złotówki i z powrotem.

const formatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

export function formatPln(grosze: number): string {
  if (!Number.isInteger(grosze)) {
    throw new Error(`Kwota musi być liczbą całkowitą groszy, otrzymano: ${grosze}`);
  }
  return formatter.format(grosze / 100);
}

/** Wartość do pola formularza: grosze → "45,00"; null → pusty tekst. */
export function groszeToInputValue(grosze: number | null): string {
  if (grosze === null) return "";
  return (grosze / 100).toFixed(2).replace(".", ",");
}

/**
 * Parsuje kwotę wpisaną przez użytkownika ("12", "12,50", "12.5", "1 250,00")
 * na grosze. Zwraca null dla wartości nieprawidłowych lub ujemnych.
 */
export function parsePlnToGrosze(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const [zloty = "0", grosze = ""] = normalized.split(".");
  return Number(zloty) * 100 + Number((grosze + "00").slice(0, 2));
}

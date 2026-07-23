/**
 * Serializacja CSV zgodna z Excelem dla polskiej lokalizacji:
 * separatorem jest średnik (Excel PL domyślnie tak czyta), a plik zaczyna się
 * od BOM, żeby polskie znaki nie były krzaczaste.
 */
const BOM = "﻿";
const SEP = ";";

function escapeCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(SEP));
  return BOM + lines.join("\r\n");
}

/** Grosze → "45,00" (przecinek dziesiętny, bez separatora tysięcy — dla arkusza). */
export function groszeToCsvNumber(grosze: number | null): string {
  if (grosze === null) return "";
  return (grosze / 100).toFixed(2).replace(".", ",");
}

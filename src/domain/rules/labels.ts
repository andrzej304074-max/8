import type { RuleField, RuleOperator } from "./types";

export const FIELD_LABELS: Record<RuleField, string> = {
  days_listed: "dni od wystawienia",
  days_in_stock: "dni w magazynie",
  views: "liczba wyświetleń",
  likes: "liczba polubień",
  price_gr: "cena (w groszach)",
  status: "status ogłoszenia",
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  gt: "większe niż",
  gte: "większe lub równe",
  lt: "mniejsze niż",
  lte: "mniejsze lub równe",
  eq: "równe",
  neq: "różne od",
};

export const ACTION_LABELS = {
  price_drop: "Obniż cenę",
  relist: "Wystaw ponownie",
  refresh: "Odśwież ogłoszenie",
} as const;

/** Pola tekstowe obsługują tylko eq/neq. */
export const TEXT_FIELDS: RuleField[] = ["status"];

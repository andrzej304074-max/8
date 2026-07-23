import { z } from "zod";

// Pola, po których reguła ocenia ogłoszenie/przedmiot.
export const RULE_FIELDS = [
  "days_listed",
  "days_in_stock",
  "views",
  "likes",
  "price_gr",
  "status",
] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const RULE_OPERATORS = ["gt", "gte", "lt", "lte", "eq", "neq"] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

const clauseSchema = z.object({
  field: z.enum(RULE_FIELDS),
  op: z.enum(RULE_OPERATORS),
  value: z.union([z.number(), z.string()]),
});
export type RuleClause = z.infer<typeof clauseSchema>;

export const conditionsSchema = z.object({
  // "all" = wszystkie warunki muszą być spełnione, "any" = wystarczy jeden.
  match: z.enum(["all", "any"]),
  clauses: z.array(clauseSchema).min(1, "Dodaj co najmniej jeden warunek"),
});
export type RuleConditions = z.infer<typeof conditionsSchema>;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("price_drop"),
    percent: z.number().min(1).max(90),
    min_price_gr: z.number().int().min(0),
    // Ile razy najwyżej obniżyć cenę TEGO SAMEGO przedmiotu (spec: "maksymalnie trzy razy").
    max_per_item: z.number().int().min(1).max(20),
  }),
  z.object({ type: z.literal("relist") }),
  z.object({ type: z.literal("refresh") }),
]);
export type RuleAction = z.infer<typeof actionSchema>;

/** Kontekst pojedynczego ogłoszenia, na którym reguła jest oceniana. */
export interface RuleContext {
  listingId: number;
  itemId: number;
  itemName: string;
  status: string;
  priceGr: number | null;
  views: number;
  likes: number;
  daysListed: number;
  daysInStock: number;
  /** Ile razy TA reguła już zadziałała na TYM ogłoszeniu (per-item limit). */
  priorExecutions: number;
}

export type RuleEffect =
  | { type: "price_drop"; oldPriceGr: number; newPriceGr: number }
  | { type: "relist" }
  | { type: "refresh" };

export interface EvalResult {
  /** Czy warunki reguły są spełnione. */
  matches: boolean;
  /** Konkretny efekt do wykonania, albo null gdy zablokowany. */
  effect: RuleEffect | null;
  /** Powód, dla którego mimo dopasowania nie ma efektu (limit, próg ceny). */
  blockedReason?: string;
}

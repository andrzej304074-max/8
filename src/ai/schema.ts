import { z } from "zod";
import { CONDITIONS } from "@/lib/labels";

/**
 * Schemat odpowiedzi modelu wizyjnego — dokładnie ten kształt wymusza prompt
 * systemowy. Odpowiedź niezgodna ze schematem → jedna ponowna próba z opisem
 * błędu, potem błąd widoczny w UI.
 */
export const aiListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(60, "tytuł przekracza 60 znaków"),
  description: z.string().trim().min(1),
  brand: z.string().trim().min(1).nullable(),
  brand_confidence: z.enum(["high", "medium", "low"]),
  category_path: z.array(z.string().trim().min(1)).min(1),
  size: z.string().trim().min(1).nullable(),
  condition: z.enum(CONDITIONS),
  color: z.array(z.string().trim().min(1)),
  material: z.string().trim().min(1).nullable(),
  measurements_needed: z.array(z.string()),
  suggested_price_pln: z.number().nonnegative(),
  price_reasoning: z.string(),
  flags: z.array(z.string()),
});

export type AiListing = z.infer<typeof aiListingSchema>;

/** Rekord przechowywany w items.ai_suggestion. */
export interface AiSuggestionRecord {
  /** Zwalidowana odpowiedź modelu (lub jej wersja po edycji tytułu/opisu). */
  data: AiListing;
  generatedAt: string;
  fromCache: boolean;
  /** Ustawiane, gdy użytkownik zaakceptował i zastosował sugestię. */
  appliedAt: string | null;
}

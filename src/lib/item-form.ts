import { z } from "zod";
import { ITEM_STATUSES } from "@/db/schema";
import { parsePlnToGrosze } from "@/domain/finance/money";

// Pole kwotowe formularza: pusty tekst → null, poprawna kwota → grosze, inaczej błąd.
const priceField = z
  .string()
  .transform((raw, ctx) => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const grosze = parsePlnToGrosze(trimmed);
    if (grosze === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nieprawidłowa kwota" });
      return z.NEVER;
    }
    return grosze;
  })
  .nullable();

const optionalText = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v.trim()))
  .nullable();

export const itemFormSchema = z.object({
  name: z.string().trim().min(1, "Nazwa robocza jest wymagana"),
  brand: optionalText,
  category: optionalText,
  size: optionalText,
  condition: optionalText,
  color: optionalText,
  material: optionalText,
  purchasePriceGr: priceField,
  expectedPriceGr: priceField,
  shippingCostGr: priceField,
  location: optionalText,
  status: z.enum(ITEM_STATUSES).default("draft"),
  notes: optionalText,
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

/** Mapuje FormData na obiekt do walidacji; brakujące pola traktuje jak puste. */
export function itemFormFromFormData(formData: FormData): Record<string, string> {
  const fields = [
    "name",
    "brand",
    "category",
    "size",
    "condition",
    "color",
    "material",
    "purchasePriceGr",
    "expectedPriceGr",
    "shippingCostGr",
    "location",
    "status",
    "notes",
  ] as const;
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (typeof value === "string" && !(field === "status" && value === "")) {
      out[field] = value;
    }
  }
  return out;
}

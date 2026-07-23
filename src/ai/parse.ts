import { aiListingSchema, type AiListing } from "./schema";

export type ParseResult =
  | { ok: true; data: AiListing }
  | { ok: false; error: string };

/**
 * Wycina obiekt JSON z odpowiedzi modelu. Prompt zakazuje markdown,
 * ale defensywnie obsługujemy bloki \`\`\`json i preambułę.
 */
export function extractJson(raw: string): string {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    text = text.slice(start, end + 1);
  }
  return text;
}

/** Parsuje i waliduje odpowiedź modelu schematem Zod. */
export function parseAiResponse(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, error: "odpowiedź nie jest poprawnym JSON" };
  }

  const result = aiListingSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `- ${i.path.join(".") || "(korzeń)"}: ${i.message}`)
      .join("\n");
    return { ok: false, error: issues };
  }
  return { ok: true, data: result.data };
}

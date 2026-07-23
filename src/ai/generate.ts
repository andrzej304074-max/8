import { parseAiResponse } from "./parse";
import { retryInstruction, USER_INSTRUCTION } from "./prompt";
import type { PhotoInput, VisionProvider } from "./provider";
import type { AiListing } from "./schema";

export class AiValidationError extends Error {
  constructor(
    message: string,
    public readonly lastRawResponse: string,
  ) {
    super(message);
    this.name = "AiValidationError";
  }
}

/**
 * Pełny cykl: zapytanie → walidacja → przy błędzie JEDNA ponowna próba
 * z komunikatem walidacji → przy drugim błędzie wyjątek widoczny w UI.
 * Czysta logika bez bazy — testowalna z zamockowanym dostawcą.
 */
export async function runGeneration(
  provider: VisionProvider,
  photos: PhotoInput[],
): Promise<AiListing> {
  if (photos.length === 0) {
    throw new Error("Przedmiot nie ma zdjęć — dodaj 1-8 zdjęć przed generowaniem.");
  }

  const first = await provider.generate(photos, USER_INSTRUCTION);
  const firstResult = parseAiResponse(first);
  if (firstResult.ok) {
    return firstResult.data;
  }

  const second = await provider.generate(photos, retryInstruction(firstResult.error));
  const secondResult = parseAiResponse(second);
  if (secondResult.ok) {
    return secondResult.data;
  }

  throw new AiValidationError(
    `Model dwukrotnie zwrócił odpowiedź niezgodną ze schematem.\nOstatnie błędy:\n${secondResult.error}`,
    second,
  );
}

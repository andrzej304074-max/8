/** Zdjęcie przekazywane do modelu wizyjnego. */
export interface PhotoInput {
  data: Buffer;
  mimeType: string;
}

/**
 * Wymienny dostawca modelu wizyjnego. Zwraca surowy tekst odpowiedzi —
 * parsowanie, walidacja i ponowna próba żyją poza dostawcą, więc podmiana
 * (Gemini → Claude → cokolwiek) nie dotyka reszty aplikacji.
 */
export interface VisionProvider {
  readonly name: string;
  generate(photos: PhotoInput[], instruction: string): Promise<string>;
}

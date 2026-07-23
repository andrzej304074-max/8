import { SYSTEM_PROMPT } from "./prompt";
import type { PhotoInput, VisionProvider } from "./provider";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 60_000;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export class GeminiProvider implements VisionProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    this.name = `gemini:${model}`;
  }

  async generate(photos: PhotoInput[], instruction: string): Promise<string> {
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            ...photos.map((photo) => ({
              inlineData: {
                mimeType: photo.mimeType,
                data: photo.data.toString("base64"),
              },
            })),
            { text: instruction },
          ],
        },
      ],
      generationConfig: {
        // Wymusza JSON na poziomie API — dodatkowa warstwa obok promptu.
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    };

    const response = await fetch(`${API_BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;

    if (!response.ok) {
      const detail = payload?.error?.message ?? `HTTP ${response.status}`;
      if (response.status === 429) {
        throw new Error(
          `Gemini: przekroczony limit zapytań darmowego planu. Odczekaj minutę i spróbuj ponownie. (${detail})`,
        );
      }
      if (response.status === 400 || response.status === 403) {
        throw new Error(
          `Gemini odrzuciło zapytanie — sprawdź GEMINI_API_KEY i GEMINI_MODEL w ustawieniach środowiska. (${detail})`,
        );
      }
      throw new Error(`Błąd Gemini: ${detail}`);
    }

    if (payload?.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini zablokowało zapytanie (${payload.promptFeedback.blockReason}) — spróbuj z innymi zdjęciami.`,
      );
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");
    if (!text) {
      throw new Error("Gemini zwróciło pustą odpowiedź — spróbuj ponownie.");
    }
    return text;
  }
}

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./data/dev.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  SESSION_SECRET: z
    .string({ required_error: "brak wartości" })
    .min(32, "musi mieć co najmniej 32 znaki"),
  APP_PASSWORD: z
    .string({ required_error: "brak wartości" })
    .min(8, "musi mieć co najmniej 8 znaków"),
  // Puste = zdjęcia na dysku lokalnym (data/uploads); ustawione = Vercel Blob.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  // Klucz do Gemini (aistudio.google.com). Puste = generowanie AI wyłączone.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  // Strefa czasowa okien publikacji i kalendarza.
  APP_TIMEZONE: z.string().min(1).default("Europe/Warsaw"),
  // Opcjonalny sekret chroniący endpoint /api/cron/tick (Vercel Cron).
  CRON_SECRET: z.string().optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Błędna konfiguracja środowiska:\n${issues}\n` +
        `Skopiuj .env.example do .env i uzupełnij wartości — instrukcja w README.md.`,
    );
  }
  return parsed.data;
}

export const config = loadConfig();

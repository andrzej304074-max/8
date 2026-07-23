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

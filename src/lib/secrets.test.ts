import { beforeAll, describe, expect, it } from "vitest";

// Konfiguracja wymaga zmiennych środowiskowych — ustawiamy przed importem.
beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-session-secret-min-32-znaki-1234567890";
  process.env.APP_PASSWORD ??= "test-haslo";
});

describe("szyfrowanie sekretów AES-256-GCM", () => {
  it("szyfruje i odszyfrowuje w obie strony", async () => {
    const { encryptSecret, decryptSecret } = await import("./secrets");
    const plaintext = "vinted-session-token-abc123";
    const enc = encryptSecret(plaintext);
    expect(decryptSecret(enc)).toBe(plaintext);
  });

  it("szyfrogram nie zawiera jawnego tekstu (zrzut bazy nie ujawnia sesji)", async () => {
    const { encryptSecret } = await import("./secrets");
    const plaintext = "wrazliwy-sekret";
    const enc = encryptSecret(plaintext);
    expect(enc.ciphertext).not.toContain(plaintext);
    expect(Buffer.from(enc.ciphertext, "base64").toString("utf8")).not.toContain(plaintext);
  });

  it("każde szyfrowanie ma inny IV (różne szyfrogramy tego samego tekstu)", async () => {
    const { encryptSecret } = await import("./secrets");
    const a = encryptSecret("to samo");
    const b = encryptSecret("to samo");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("manipulacja szyfrogramem jest wykrywana (GCM auth)", async () => {
    const { encryptSecret, decryptSecret } = await import("./secrets");
    const enc = encryptSecret("oryginał");
    const tampered = Buffer.from(enc.ciphertext, "base64");
    tampered[tampered.length - 1] ^= 0xff; // zmiana ostatniego bajtu
    expect(() =>
      decryptSecret({ ciphertext: tampered.toString("base64"), iv: enc.iv }),
    ).toThrow();
  });
});

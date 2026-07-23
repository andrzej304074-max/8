import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { config } from "@/lib/config";

/**
 * Szyfrowanie sekretów sesji AES-256-GCM. Klucz wyprowadzamy z SESSION_SECRET
 * (żyje wyłącznie w zmiennej środowiskowej), więc sam zrzut bazy nie ujawnia
 * sesji. GCM daje też uwierzytelnienie — manipulacja szyfrogramem jest wykrywana.
 */
function key(): Buffer {
  // 32 bajty z SESSION_SECRET — deterministycznie, bez trzymania klucza w bazie.
  return createHash("sha256").update(config.SESSION_SECRET).digest();
}

export interface EncryptedSecret {
  ciphertext: string; // base64: authTag(16) + dane
  iv: string; // base64
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([authTag, encrypted]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const raw = Buffer.from(secret.ciphertext, "base64");
  const authTag = raw.subarray(0, 16);
  const data = raw.subarray(16);
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

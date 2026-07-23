import { createHash } from "node:crypto";

/**
 * Hash zestawu zdjęć do cache odpowiedzi AI. Hashe pojedynczych zdjęć są
 * sortowane przed złączeniem — ta sama paczka zdjęć w innej kolejności
 * to wciąż ten sam przedmiot, więc nie płacimy za nią drugi raz.
 */
export function photoSetHash(photoBuffers: Buffer[]): string {
  const individual = photoBuffers
    .map((buf) => createHash("sha256").update(buf).digest("hex"))
    .sort();
  return createHash("sha256").update(individual.join(":")).digest("hex");
}

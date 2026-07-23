import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processPhoto } from "./images";

/** Testowy JPEG 300x200 z EXIF zawierającym GPS i orientację. */
async function makePhotoWithExif(orientation = 1): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 120, g: 80, b: 40 } },
  })
    .jpeg()
    .withExif({
      IFD0: { Software: "test-suite" },
      GPS: {
        GPSLatitudeRef: "N",
        GPSLatitude: "52/1 13/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "21/1 0/1 0/1",
      },
    })
    // withExif nie ustawia znacznika orientacji — robi to withMetadata.
    .withMetadata({ orientation })
    .toBuffer();
}

describe("processPhoto", () => {
  it("wejściowy plik testowy faktycznie zawiera EXIF (kontrola testu)", async () => {
    const meta = await sharp(await makePhotoWithExif()).metadata();
    expect(meta.exif).toBeDefined();
  });

  it("usuwa wszystkie metadane EXIF, w tym GPS, z obu wersji", async () => {
    const result = await processPhoto(await makePhotoWithExif());
    const originalMeta = await sharp(result.original).metadata();
    const processedMeta = await sharp(result.processed).metadata();
    expect(originalMeta.exif).toBeUndefined();
    expect(processedMeta.exif).toBeUndefined();
  });

  it("trwale nanosi orientację EXIF (obrót o 90 stopni zamienia boki)", async () => {
    // Orientacja 6 = obrócone o 90° zgodnie z ruchem wskazówek zegara.
    const result = await processPhoto(await makePhotoWithExif(6));
    const meta = await sharp(result.original).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(300);
    expect(meta.orientation).toBeUndefined();
  });

  it("skaluje wersję przetworzoną maksymalnie do 1600 px, nie powiększając małych", async () => {
    const small = await processPhoto(await makePhotoWithExif());
    expect(Math.max(small.width, small.height)).toBe(300);

    const big = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    const scaled = await processPhoto(big);
    expect(Math.max(scaled.width, scaled.height)).toBe(1600);
  });
});

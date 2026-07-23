import { describe, expect, it } from "vitest";
import { photoSetHash } from "./hash";

describe("photoSetHash", () => {
  const a = Buffer.from("zdjecie-a");
  const b = Buffer.from("zdjecie-b");

  it("ten sam zestaw daje ten sam hash niezależnie od kolejności", () => {
    expect(photoSetHash([a, b])).toBe(photoSetHash([b, a]));
  });

  it("inny zestaw daje inny hash", () => {
    expect(photoSetHash([a])).not.toBe(photoSetHash([a, b]));
    expect(photoSetHash([a])).not.toBe(photoSetHash([b]));
  });
});

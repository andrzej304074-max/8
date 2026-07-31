import { describe, expect, it } from "vitest";
import { normalizeSessionInput } from "./vinted-cookies";

describe("normalizeSessionInput", () => {
  it("przyjmuje listę JSON (format zdalnej przeglądarki)", () => {
    const raw = JSON.stringify([
      { name: "_vinted_fr_session", value: "abc", domain: ".vinted.pl", path: "/" },
    ]);
    const result = normalizeSessionInput(raw);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.name).toBe("_vinted_fr_session");
  });

  it("przyjmuje obiekt z polem cookies", () => {
    const raw = JSON.stringify({ cookies: [{ name: "a", value: "1" }] });
    expect(normalizeSessionInput(raw)).toHaveLength(1);
  });

  it("przyjmuje zwykły nagłówek Cookie z przeglądarki", () => {
    const result = normalizeSessionInput("_vinted_fr_session=xyz; anon_id=123");
    expect(result).toHaveLength(2);
    expect(result?.[0]).toMatchObject({ name: "_vinted_fr_session", value: "xyz" });
    expect(result?.[1]).toMatchObject({ name: "anon_id", value: "123" });
  });

  it("uzupełnia brakującą domenę i ścieżkę", () => {
    const result = normalizeSessionInput(JSON.stringify([{ name: "a", value: "1" }]));
    expect(result?.[0]?.domain).toBe(".vinted.pl");
    expect(result?.[0]?.path).toBe("/");
  });

  it("zachowuje domenę, gdy została podana", () => {
    const raw = JSON.stringify([{ name: "a", value: "1", domain: ".vinted.co.uk", path: "/x" }]);
    const result = normalizeSessionInput(raw);
    expect(result?.[0]?.domain).toBe(".vinted.co.uk");
    expect(result?.[0]?.path).toBe("/x");
  });

  it("wartość ciasteczka może zawierać znak równości", () => {
    const result = normalizeSessionInput("token=abc=def==");
    expect(result?.[0]?.value).toBe("abc=def==");
  });

  it("odrzuca puste i bezsensowne wejście", () => {
    expect(normalizeSessionInput("")).toBeNull();
    expect(normalizeSessionInput("   ")).toBeNull();
    expect(normalizeSessionInput("[nie-json")).toBeNull();
    expect(normalizeSessionInput("bez-znaku-rownosci")).toBeNull();
    expect(normalizeSessionInput("[]")).toBeNull();
  });

  it("pomija wpisy bez nazwy lub wartości", () => {
    const raw = JSON.stringify([{ name: "ok", value: "1" }, { value: "brak-nazwy" }, {}]);
    expect(normalizeSessionInput(raw)).toHaveLength(1);
  });
});

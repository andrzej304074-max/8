/**
 * Normalizacja sesji Vinted do jednego formatu (lista ciasteczek Playwright).
 *
 * Sesję można podać na dwa sposoby i oba muszą działać:
 *  1. JSON — tak zapisuje ją zdalna przeglądarka i lokalny skrypt,
 *  2. zwykły ciąg "nazwa=wartość; nazwa2=wartość2" — tak wygląda nagłówek Cookie
 *     skopiowany z narzędzi deweloperskich przeglądarki.
 */

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  expires?: number;
  sameSite?: "Strict" | "Lax" | "None";
}

const DEFAULT_DOMAIN = ".vinted.pl";

function isValidCookie(value: unknown): value is SessionCookie {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.name === "string" && c.name !== "" && typeof c.value === "string";
}

/** Uzupełnia brakujące pola wymagane przez przeglądarkę. */
function withDefaults(cookie: SessionCookie): SessionCookie {
  return {
    ...cookie,
    domain: cookie.domain && cookie.domain !== "" ? cookie.domain : DEFAULT_DOMAIN,
    path: cookie.path && cookie.path !== "" ? cookie.path : "/",
  };
}

/**
 * Zwraca listę ciasteczek albo null, gdy wejścia nie da się zinterpretować.
 * Nigdy nie rzuca — wywołujący decyduje, co zrobić z null.
 */
export function normalizeSessionInput(raw: string): SessionCookie[] | null {
  const text = raw.trim();
  if (text === "") return null;

  // 1) Format JSON (lista ciasteczek albo obiekt z polem "cookies").
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(text);
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as { cookies?: unknown }).cookies;
      if (!Array.isArray(list)) return null;
      const cookies = list.filter(isValidCookie).map(withDefaults);
      return cookies.length > 0 ? cookies : null;
    } catch {
      return null;
    }
  }

  // 2) Nagłówek Cookie: "nazwa=wartość; nazwa2=wartość2".
  const cookies: SessionCookie[] = [];
  for (const part of text.split(";")) {
    const trimmed = part.trim();
    if (trimmed === "") continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name === "") continue;
    cookies.push(withDefaults({ name, value, domain: DEFAULT_DOMAIN, path: "/" }));
  }
  return cookies.length > 0 ? cookies : null;
}

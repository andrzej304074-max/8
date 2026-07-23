import { readFile } from "node:fs/promises";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/session-options";
import { resolveUploadPath } from "@/storage/local";

/**
 * Serwuje zdjęcia z dysku w trybie lokalnym. Adresy z kropką omijają middleware
 * (wzorzec wyklucza pliki statyczne), więc autoryzację sprawdzamy tutaj jawnie.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) {
    return NextResponse.json({ error: "Wymagane logowanie" }, { status: 401 });
  }

  const { path: segments } = await params;
  let absolute: string;
  try {
    absolute = resolveUploadPath(segments.join("/"));
  } catch {
    return NextResponse.json({ error: "Nieprawidłowa ścieżka" }, { status: 400 });
  }

  let data: Buffer;
  try {
    data = await readFile(absolute);
  } catch {
    return NextResponse.json({ error: "Nie znaleziono pliku" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

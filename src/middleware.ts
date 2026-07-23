import { getIronSession } from "iron-session";
import { NextResponse, type NextRequest } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/session-options";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  if (!session.loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  // Chronimy wszystko poza stroną logowania, zasobami Next i plikami statycznymi.
  matcher: ["/((?!login|_next/static|_next/image|favicon\\.ico|.*\\..*).*)"],
};

// Ten plik musi pozostać zgodny z Edge Runtime (importuje go middleware) —
// żadnych importów z node:*.
import type { SessionOptions } from "iron-session";
import { config } from "@/lib/config";

export interface SessionData {
  loggedIn?: boolean;
}

export const sessionOptions: SessionOptions = {
  password: config.SESSION_SECRET,
  cookieName: "vm_session",
  ttl: 60 * 60 * 24 * 14,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

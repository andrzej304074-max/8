"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { getSession } from "@/lib/session";

export interface LoginState {
  error: string;
}

export async function login(
  _prev: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Podaj hasło." };
  }

  // Porównujemy hashe w stałym czasie — timingSafeEqual wymaga buforów równej długości.
  const given = createHash("sha256").update(password).digest();
  const expected = createHash("sha256").update(config.APP_PASSWORD).digest();
  if (!timingSafeEqual(given, expected)) {
    return { error: "Nieprawidłowe hasło." };
  }

  const session = await getSession();
  session.loggedIn = true;
  await session.save();
  redirect("/magazyn");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { DEFAULT_VINTED_CONFIG, VintedAdapter } from "@/adapters/vinted/vinted-adapter";
import { DisabledVintedTransport } from "@/adapters/vinted/transport";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { logEvent } from "@/lib/event-log";
import {
  clearAccountSession,
  getAccountSession,
  markSessionExpired,
  setAccountSession,
} from "@/lib/vinted-session-service";

export async function saveVintedSession(
  accountId: number,
  formData: FormData,
): Promise<ActionResult> {
  const session = String(formData.get("session") ?? "").trim();
  if (session === "") return { ok: false, error: "Wklej sesję do zapisania." };
  await setAccountSession(accountId, session);
  revalidatePath("/ustawienia");
  return { ok: true, data: undefined };
}

export async function removeVintedSession(accountId: number): Promise<ActionResult> {
  await clearAccountSession(accountId);
  revalidatePath("/ustawienia");
  return { ok: true, data: undefined };
}

export async function expireVintedSession(accountId: number): Promise<ActionResult<{ pausedJobs: number }>> {
  const result = await markSessionExpired(accountId);
  revalidatePath("/ustawienia");
  revalidatePath("/kolejka");
  return { ok: true, data: result };
}

export interface DiagnosticResult {
  outcome: string;
  breakerState: string;
  note: string;
}

/**
 * Diagnostyka na sucho: uruchamia REALNY VintedAdapter z całą warstwą
 * bezpieczeństwa, ale z transportem, który nic nie wysyła. Pokazuje, że
 * maszyneria działa (limiter, wyłącznik), a integracja jest bezpiecznie
 * wyłączona — bez żadnego ruchu sieciowego.
 */
export async function runVintedDiagnostic(
  accountId: number,
): Promise<ActionResult<DiagnosticResult>> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return { ok: false, error: "Konto nie istnieje" };

  const session = await getAccountSession(accountId);
  const adapter = new VintedAdapter(
    new DisabledVintedTransport(),
    DEFAULT_VINTED_CONFIG,
    session ?? "diagnostyka-brak-realnej-sesji",
  );

  const result = await adapter.publish(
    {
      listingId: 0,
      itemId: 0,
      title: "Diagnostyka (nic nie zostanie wysłane)",
      description: "",
      priceGr: null,
      categoryPath: [],
      condition: null,
      size: null,
      brand: null,
      colors: [],
      material: null,
      photoUrls: [],
    },
    {
      account,
      log: (action, outcome, detail, payload) =>
        logEvent({ actor: "app", account: account.name, action: `diag.${action}`, outcome, detail, payload }),
    },
  );

  const snap = adapter.breakerSnapshot();
  revalidatePath("/historia");

  return {
    ok: true,
    data: {
      outcome:
        result.kind === "unsupported"
          ? result.reason
          : "Nieoczekiwany wynik — sprawdź Historię.",
      breakerState: snap.state,
      note: "Adapter zadziałał, ale transport jest wyłączony — żaden pakiet nie opuścił serwera. Zdarzenia w Historii z prefiksem diag.",
    },
  };
}

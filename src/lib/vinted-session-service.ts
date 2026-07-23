import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, jobs, secrets } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { logEvent } from "@/lib/event-log";

/**
 * Zapisuje sesję konta WYŁĄCZNIE w postaci zaszyfrowanej (secrets), a w koncie
 * trzyma tylko referencję (secret_ref) — nigdy sam sekret. Odpowiednik keychainu
 * z architektury, dostosowany do wersji serwerowej.
 */
export async function setAccountSession(accountId: number, session: string): Promise<void> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error("Konto nie istnieje");

  const ref = account.secretRef ?? `sec_${randomUUID()}`;
  const enc = encryptSecret(session);

  await db
    .insert(secrets)
    .values({ ref, ciphertext: enc.ciphertext, iv: enc.iv })
    .onConflictDoUpdate({
      target: secrets.ref,
      set: { ciphertext: enc.ciphertext, iv: enc.iv, updatedAt: new Date().toISOString() },
    });

  await db
    .update(accounts)
    .set({ secretRef: ref, sessionStatus: "active" })
    .where(eq(accounts.id, accountId));

  await logEvent({
    actor: "user",
    account: account.name,
    action: "session.set",
    outcome: "ok",
    detail: "Zapisano zaszyfrowaną sesję konta (sekret nie trafia do bazy jawnym tekstem)",
  });
}

/** Odczytuje i odszyfrowuje sesję konta; null gdy brak. */
export async function getAccountSession(accountId: number): Promise<string | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account?.secretRef) return null;
  const [secret] = await db.select().from(secrets).where(eq(secrets.ref, account.secretRef));
  if (!secret) return null;
  try {
    return decryptSecret({ ciphertext: secret.ciphertext, iv: secret.iv });
  } catch {
    return null;
  }
}

export async function clearAccountSession(accountId: number): Promise<void> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return;
  if (account.secretRef) {
    await db.delete(secrets).where(eq(secrets.ref, account.secretRef));
  }
  await db
    .update(accounts)
    .set({ secretRef: null, sessionStatus: "manual" })
    .where(eq(accounts.id, accountId));
  await logEvent({
    actor: "user",
    account: account.name,
    action: "session.cleared",
    outcome: "ok",
    detail: "Usunięto sesję konta",
  });
}

/**
 * Przepływ „sesja wygasła": oznacza konto jako expired, WSTRZYMUJE jego
 * oczekujące zadania (zamiast generować kaskadę błędów) i loguje. Dokładnie to
 * robi warstwa wyżej, gdy adapter zgłosi SessionExpiredError.
 */
export async function markSessionExpired(accountId: number): Promise<{ pausedJobs: number }> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return { pausedJobs: 0 };

  await db
    .update(accounts)
    .set({ sessionStatus: "expired" })
    .where(eq(accounts.id, accountId));

  const paused = await db
    .update(jobs)
    .set({ status: "paused", lastError: "Sesja konta wygasła — kolejka wstrzymana." })
    .where(and(eq(jobs.accountId, accountId), inArray(jobs.status, ["pending", "due"])))
    .returning({ id: jobs.id });

  await logEvent({
    actor: "app",
    account: account.name,
    action: "session.expired",
    outcome: "error",
    detail: `Sesja wygasła — wstrzymano ${paused.length} zadań, wymagane odnowienie sesji.`,
  });

  return { pausedJobs: paused.length };
}

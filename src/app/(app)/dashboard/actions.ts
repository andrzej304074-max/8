"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { logEvent } from "@/lib/event-log";
import { createListingCore } from "@/lib/listing-service";

/**
 * Wykonanie zadania publikacji z listy „Do zrobienia". Człowiek w pętli:
 * tworzymy szkic ogłoszenia i przenosimy użytkownika na stronę paczki —
 * to on decyduje o faktycznej publikacji. Zadanie zostaje oznaczone jako
 * wykonane dopiero po powodzeniu (idempotencja: powtórka nie zdubluje ogłoszenia).
 */
export async function executeJob(jobId: number): Promise<ActionResult> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return { ok: false, error: "Zadanie nie istnieje" };
  if (job.status === "done") return { ok: false, error: "Zadanie już wykonane" };
  if (job.itemId === null || job.accountId === null) {
    return { ok: false, error: "Zadanie nie ma przypisanego przedmiotu lub konta" };
  }

  await db.update(jobs).set({ status: "running" }).where(eq(jobs.id, jobId));

  const created = await createListingCore(job.itemId, job.accountId);
  if (!created.ok) {
    await db
      .update(jobs)
      .set({ status: "failed", attempts: job.attempts + 1, lastError: created.error })
      .where(eq(jobs.id, jobId));
    await logEvent({
      actor: "app",
      action: "job.execute",
      outcome: "error",
      detail: `Zadanie #${jobId}: ${created.error}`,
    });
    return { ok: false, error: created.error };
  }

  await db
    .update(jobs)
    .set({
      status: "done",
      result: JSON.stringify({ listingId: created.id }),
    })
    .where(eq(jobs.id, jobId));

  revalidatePath("/dashboard");
  revalidatePath("/kolejka");
  redirect(`/ogloszenia/${created.id}`);
}

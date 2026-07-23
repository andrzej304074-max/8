"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AiSuggestionRecord } from "@/ai/schema";
import { getAdapterForAccount } from "@/adapters";
import { loadListingBundle } from "@/adapters/payload";
import type { ActionResult } from "@/app/(app)/magazyn/actions";
import { db } from "@/db";
import { accounts, items, listings } from "@/db/schema";
import { logEvent } from "@/lib/event-log";

export async function createListing(
  itemId: number,
  accountId: number,
): Promise<ActionResult<{ id: number }>> {
  const [item] = await db.select().from(items).where(eq(items.id, itemId));
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!item || !account) {
    return { ok: false, error: "Przedmiot lub konto nie istnieje" };
  }

  // Tytuł i opis: najpierw zaakceptowana sugestia AI, potem dane przedmiotu.
  let title = item.name;
  let description = item.notes ?? "";
  if (item.aiSuggestion) {
    try {
      const record = JSON.parse(item.aiSuggestion) as AiSuggestionRecord;
      title = record.data.title;
      description = record.data.description;
    } catch {
      // uszkodzony rekord AI — zostają dane przedmiotu
    }
  }

  const [created] = await db
    .insert(listings)
    .values({
      itemId,
      accountId,
      platform: account.platform,
      title: title.slice(0, 60),
      description,
      priceGr: item.expectedPriceGr,
      status: "draft",
      createdVia: "manual",
    })
    .returning({ id: listings.id });

  if (!created) {
    return { ok: false, error: "Nie udało się utworzyć ogłoszenia" };
  }

  await logEvent({
    actor: "user",
    account: account.name,
    action: "listing.created",
    outcome: "ok",
    detail: `Szkic ogłoszenia #${created.id} dla przedmiotu „${item.name}"`,
  });

  revalidatePath(`/magazyn/${itemId}`);
  redirect(`/ogloszenia/${created.id}`);
}

export async function markListingPublished(
  listingId: number,
  formData: FormData,
): Promise<ActionResult> {
  const bundle = await loadListingBundle(listingId);
  if (!bundle) {
    return { ok: false, error: "Ogłoszenie nie istnieje" };
  }
  const externalRef = String(formData.get("externalRef") ?? "").trim() || null;
  const now = new Date().toISOString();

  await db
    .update(listings)
    .set({
      status: "published",
      publishedAt: now,
      refreshedAt: now,
      externalId: externalRef,
      createdVia: "manual",
    })
    .where(eq(listings.id, listingId));

  // Przedmiot wystawiony — status magazynowy idzie w górę automatycznie.
  await db
    .update(items)
    .set({ status: "listed" })
    .where(eq(items.id, bundle.item.id));

  await logEvent({
    actor: "user",
    account: bundle.account.name,
    action: "listing.published_manual",
    outcome: "ok",
    detail: `Ogłoszenie #${listingId} („${bundle.listing.title}") oznaczone jako opublikowane ręcznie`,
    payload: externalRef ? { externalRef } : undefined,
  });

  revalidatePath(`/ogloszenia/${listingId}`);
  revalidatePath(`/magazyn/${bundle.item.id}`);
  revalidatePath("/magazyn");
  return { ok: true, data: undefined };
}

export async function runDryRunPublish(listingId: number): Promise<ActionResult> {
  const bundle = await loadListingBundle(listingId);
  if (!bundle) {
    return { ok: false, error: "Ogłoszenie nie istnieje" };
  }
  const adapter = getAdapterForAccount(bundle.account);
  await adapter.publish(bundle.payload, {
    account: bundle.account,
    log: (action, outcome, detail, payload) =>
      logEvent({ actor: "app", account: bundle.account.name, action, outcome, detail, payload }),
  });
  revalidatePath("/historia");
  return { ok: true, data: undefined };
}

export async function deleteListing(listingId: number): Promise<ActionResult> {
  const bundle = await loadListingBundle(listingId);
  if (!bundle) {
    return { ok: false, error: "Ogłoszenie nie istnieje" };
  }
  if (bundle.listing.status !== "draft") {
    return { ok: false, error: "Usuwać można tylko szkice ogłoszeń" };
  }
  await db.delete(listings).where(eq(listings.id, listingId));
  await logEvent({
    actor: "user",
    account: bundle.account.name,
    action: "listing.draft_deleted",
    outcome: "ok",
    detail: `Usunięto szkic ogłoszenia #${listingId}`,
  });
  revalidatePath(`/magazyn/${bundle.item.id}`);
  redirect(`/magazyn/${bundle.item.id}`);
}

import type { ItemStatus, ListingStatus } from "@/db/schema";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Szkic",
  ready: "Gotowy",
  listed: "Wystawiony",
  reserved: "Zarezerwowany",
  sold: "Sprzedany",
  returned: "Zwrot",
  archived: "Zarchiwizowany",
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Szkic",
  scheduled: "Zaplanowane",
  published: "Opublikowane",
  ended: "Zakończone",
  sold: "Sprzedane",
};

export const CONDITIONS = [
  "nowy z metką",
  "nowy bez metki",
  "bardzo dobry",
  "dobry",
  "zadowalający",
] as const;

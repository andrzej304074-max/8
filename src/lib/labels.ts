import type { ItemStatus, JobStatus, ListingStatus } from "@/db/schema";

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

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Zaplanowane",
  paused: "Wstrzymane",
  due: "Do zrobienia",
  running: "W trakcie",
  done: "Wykonane",
  failed: "Błąd",
  cancelled: "Anulowane",
};

export const WEEKDAY_LABELS = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"] as const;

export const CONDITIONS = [
  "nowy z metką",
  "nowy bez metki",
  "bardzo dobry",
  "dobry",
  "zadowalający",
] as const;

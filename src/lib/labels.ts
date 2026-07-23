import type { ItemStatus } from "@/db/schema";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Szkic",
  ready: "Gotowy",
  listed: "Wystawiony",
  reserved: "Zarezerwowany",
  sold: "Sprzedany",
  returned: "Zwrot",
  archived: "Zarchiwizowany",
};

export const CONDITIONS = [
  "nowy z metką",
  "nowy bez metki",
  "bardzo dobry",
  "dobry",
  "zadowalający",
] as const;

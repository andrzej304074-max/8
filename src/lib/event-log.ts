import { db } from "@/db";
import { eventLog } from "@/db/schema";

/**
 * Jedyna droga zapisu do EventLog. Dziennik jest niezmienialny — aplikacja
 * tylko dopisuje; nie ma żadnej ścieżki edycji ani usuwania wpisów.
 */
export async function logEvent(entry: {
  actor: "app" | "user";
  account?: string | null;
  action: string;
  outcome: "ok" | "error";
  detail?: string | null;
  payload?: unknown;
}): Promise<void> {
  await db.insert(eventLog).values({
    actor: entry.actor,
    account: entry.account ?? null,
    action: entry.action,
    outcome: entry.outcome,
    detail: entry.detail ?? null,
    payload:
      entry.payload === undefined ? null : JSON.stringify(entry.payload),
  });
}

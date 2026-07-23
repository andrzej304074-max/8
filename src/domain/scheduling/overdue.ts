// Decyzja o zaległych zadaniach po restarcie/przerwie — spec: scheduler czyta
// zaległe zadania i decyduje, czy je wykonać, czy przesunąć.

const STALE_AFTER_HOURS = 72;

export type OverdueDecision =
  | { kind: "make_due" }
  | { kind: "reschedule" };

/**
 * Zadanie po terminie: świeżo zaległe (do 72 h) trafia na listę "Do zrobienia";
 * starsze jest przesuwane w najbliższe okno — pokazywanie tygodniowych zaległości
 * jako "do zrobienia dziś" tworzyłoby lawinę, której nikt nie wykona.
 */
export function resolveOverdue(scheduledAtIso: string, now: Date): OverdueDecision {
  const overdueHours =
    (now.getTime() - new Date(scheduledAtIso).getTime()) / 3_600_000;
  return overdueHours <= STALE_AFTER_HOURS
    ? { kind: "make_due" }
    : { kind: "reschedule" };
}

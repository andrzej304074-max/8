import type { ScheduleSettings } from "@/lib/schedule-settings";

/** Slot publikacji: dzień kalendarzowy (w strefie użytkownika) + minuty od północy. */
export interface PlannedSlot {
  dayKey: string;
  minutesFromMidnight: number;
}

export interface PlanInput {
  settings: ScheduleSettings;
  /** Ile przedmiotów trzeba rozplanować. */
  count: number;
  /** Kolejne dni w horyzoncie, od dziś: klucz + dzień tygodnia (0-6). */
  daysAhead: Array<{ dayKey: string; weekday: number }>;
  /** Minuty od północy "teraz" dla pierwszego dnia (żeby nie planować w przeszłość). */
  nowMinutesToday: number;
  /** Już zaplanowane zadania per dzień — respektowane przy limitach dziennych. */
  existingPerDay: ReadonlyMap<string, number>;
  /** Twarde limity konta; null = bez limitu. */
  maxPerDay: number | null;
  maxPerHour: number | null;
  /** Źródło losowości 0..1 — wstrzykiwane dla testowalności. */
  random: () => number;
}

/**
 * Rozkłada `count` publikacji na sloty w kolejnych dniach: równomiernie w oknie
 * godzinowym, z losowym rozrzutem, respektując dni tygodnia, limit dzienny
 * (ustawienie i twardy limit konta) oraz twardy limit na godzinę.
 * Czysta funkcja — zero dat "teraz", zero bazy.
 */
export function planSlots(input: PlanInput): PlannedSlot[] {
  const { settings, maxPerDay, maxPerHour, random } = input;
  const slots: PlannedSlot[] = [];
  let remaining = input.count;

  const windowStartMin = settings.windowStartHour * 60;
  const windowEndMin = settings.windowEndHour * 60;

  for (const [dayIndex, day] of input.daysAhead.entries()) {
    if (remaining <= 0) break;
    if (!settings.days.includes(day.weekday)) continue;

    const existing = input.existingPerDay.get(day.dayKey) ?? 0;
    const dailyCap = Math.min(
      settings.itemsPerDay,
      maxPerDay ?? Number.POSITIVE_INFINITY,
    );
    let capacity = Math.max(0, dailyCap - existing);
    if (capacity === 0) continue;

    // Pierwszego dnia nie planujemy w przeszłość — zaczynamy od "teraz".
    const isToday = dayIndex === 0;
    const effectiveStart = isToday
      ? Math.max(windowStartMin, input.nowMinutesToday + 5)
      : windowStartMin;
    if (effectiveStart >= windowEndMin) continue;

    const todayCount = Math.min(capacity, remaining);
    const interval = (windowEndMin - effectiveStart) / todayCount;
    const perHour = new Map<number, number>();

    for (let i = 0; i < todayCount; i++) {
      const base = effectiveStart + (i + 0.5) * interval;
      const jitter = (random() * 2 - 1) * settings.jitterMinutes;
      let minutes = Math.round(
        Math.min(windowEndMin - 1, Math.max(effectiveStart, base + jitter)),
      );

      // Twardy limit na godzinę: przepełniona godzina spycha slot dalej.
      if (maxPerHour !== null) {
        let hour = Math.floor(minutes / 60);
        while ((perHour.get(hour) ?? 0) >= maxPerHour && hour * 60 < windowEndMin) {
          hour += 1;
          minutes = hour * 60 + Math.round(random() * Math.min(30, settings.jitterMinutes || 30));
        }
        if (hour * 60 >= windowEndMin) {
          // Dzień nie pomieści kolejnych slotów w limicie godzinowym.
          capacity = i;
          break;
        }
        perHour.set(hour, (perHour.get(hour) ?? 0) + 1);
      }

      slots.push({ dayKey: day.dayKey, minutesFromMidnight: minutes });
      remaining -= 1;
    }
  }

  return slots;
}

import { describe, expect, it } from "vitest";
import type { ScheduleSettings } from "@/lib/schedule-settings";
import { planSlots, type PlanInput } from "./planner";

const SETTINGS: ScheduleSettings = {
  itemsPerDay: 3,
  windowStartHour: 8,
  windowEndHour: 21,
  days: [1, 2, 3, 4, 5], // pn-pt
  jitterMinutes: 0,
};

const WEEK = [
  { dayKey: "2026-07-27", weekday: 1 },
  { dayKey: "2026-07-28", weekday: 2 },
  { dayKey: "2026-07-29", weekday: 3 },
  { dayKey: "2026-07-30", weekday: 4 },
  { dayKey: "2026-07-31", weekday: 5 },
  { dayKey: "2026-08-01", weekday: 6 },
  { dayKey: "2026-08-02", weekday: 0 },
];

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    settings: SETTINGS,
    count: 5,
    daysAhead: WEEK,
    nowMinutesToday: 0,
    existingPerDay: new Map(),
    maxPerDay: null,
    maxPerHour: null,
    random: () => 0.5,
    ...overrides,
  };
}

describe("planSlots", () => {
  it("rozkłada zadania po maks. itemsPerDay dziennie, tylko w dozwolone dni", () => {
    const slots = planSlots(input());
    expect(slots).toHaveLength(5);
    const byDay = Map.groupBy(slots, (s) => s.dayKey);
    expect(byDay.get("2026-07-27")).toHaveLength(3);
    expect(byDay.get("2026-07-28")).toHaveLength(2);
    expect(byDay.has("2026-08-01")).toBe(false);
    expect(byDay.has("2026-08-02")).toBe(false);
  });

  it("wszystkie sloty mieszczą się w oknie godzinowym", () => {
    const slots = planSlots(input({ count: 12 }));
    for (const slot of slots) {
      expect(slot.minutesFromMidnight).toBeGreaterThanOrEqual(8 * 60);
      expect(slot.minutesFromMidnight).toBeLessThan(21 * 60);
    }
  });

  it("pierwszego dnia nie planuje w przeszłość", () => {
    const slots = planSlots(input({ count: 2, nowMinutesToday: 20 * 60 }));
    const today = slots.filter((s) => s.dayKey === "2026-07-27");
    for (const slot of today) {
      expect(slot.minutesFromMidnight).toBeGreaterThan(20 * 60);
    }
  });

  it("respektuje istniejące zadania przy limicie dziennym", () => {
    const slots = planSlots(
      input({ count: 3, existingPerDay: new Map([["2026-07-27", 2]]) }),
    );
    const byDay = Map.groupBy(slots, (s) => s.dayKey);
    expect(byDay.get("2026-07-27")).toHaveLength(1);
    expect(byDay.get("2026-07-28")).toHaveLength(2);
  });

  it("twardy limit dzienny konta wygrywa z itemsPerDay", () => {
    const slots = planSlots(input({ count: 4, maxPerDay: 1 }));
    const byDay = Map.groupBy(slots, (s) => s.dayKey);
    for (const dayJobs of byDay.values()) {
      expect(dayJobs).toHaveLength(1);
    }
  });

  it("twardy limit na godzinę rozpycha sloty na kolejne godziny", () => {
    const slots = planSlots(
      input({
        count: 3,
        maxPerHour: 1,
        settings: { ...SETTINGS, itemsPerDay: 3, windowStartHour: 8, windowEndHour: 11 },
      }),
    );
    const hours = slots.map((s) => Math.floor(s.minutesFromMidnight / 60));
    expect(new Set(hours).size).toBe(hours.length);
  });

  it("rozrzut losowy jest ograniczony przez jitterMinutes", () => {
    const base = planSlots(input({ count: 1 }))[0];
    const jittered = planSlots(
      input({ count: 1, settings: { ...SETTINGS, jitterMinutes: 30 }, random: () => 1 }),
    )[0];
    expect(base).toBeDefined();
    expect(jittered).toBeDefined();
    if (base && jittered) {
      expect(Math.abs(jittered.minutesFromMidnight - base.minutesFromMidnight)).toBeLessThanOrEqual(30);
    }
  });

  it("jest deterministyczny przy ustalonym random", () => {
    expect(planSlots(input())).toEqual(planSlots(input()));
  });
});

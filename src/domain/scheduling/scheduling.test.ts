import { describe, expect, it } from "vitest";
import { resolveOverdue } from "./overdue";
import {
  dayKeyInZone,
  nextDayKey,
  tzOffsetMinutes,
  weekdayInZone,
  zonedTimeToUtc,
} from "./timezone";

describe("resolveOverdue", () => {
  const now = new Date("2026-07-23T12:00:00Z");

  it("świeżo zaległe (do 72h) trafia na listę do zrobienia", () => {
    expect(resolveOverdue("2026-07-23T10:00:00Z", now).kind).toBe("make_due");
    expect(resolveOverdue("2026-07-21T12:00:00Z", now).kind).toBe("make_due");
  });

  it("starsze niż 72h jest przesuwane, nie wykonywane", () => {
    expect(resolveOverdue("2026-07-19T11:00:00Z", now).kind).toBe("reschedule");
  });
});

describe("strefa czasowa Europe/Warsaw", () => {
  it("offset: +120 min latem (CEST), +60 min zimą (CET)", () => {
    expect(tzOffsetMinutes("Europe/Warsaw", new Date("2026-07-15T12:00:00Z"))).toBe(120);
    expect(tzOffsetMinutes("Europe/Warsaw", new Date("2026-01-15T12:00:00Z"))).toBe(60);
  });

  it("zonedTimeToUtc: 10:00 w Warszawie latem = 08:00 UTC", () => {
    const utc = zonedTimeToUtc("Europe/Warsaw", "2026-07-27", 10 * 60);
    expect(utc.toISOString()).toBe("2026-07-27T08:00:00.000Z");
  });

  it("dayKey i weekday liczone w strefie, nie w UTC", () => {
    // 23:30 UTC 27.07 to już 28.07 w Warszawie.
    const lateEvening = new Date("2026-07-27T23:30:00Z");
    expect(dayKeyInZone("Europe/Warsaw", lateEvening)).toBe("2026-07-28");
    expect(weekdayInZone("Europe/Warsaw", lateEvening)).toBe(2); // wtorek
  });

  it("nextDayKey przechodzi przez granice miesięcy", () => {
    expect(nextDayKey("2026-07-31")).toBe("2026-08-01");
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });
});

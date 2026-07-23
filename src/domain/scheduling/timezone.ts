// Minimalna obsługa stref czasowych bez zewnętrznych bibliotek.
// Okna publikacji są rozumiane w strefie użytkownika (APP_TIMEZONE),
// a w bazie zawsze leżą znaczniki UTC ISO.

/** Przesunięcie strefy względem UTC (w minutach) w danym momencie. */
export function tzOffsetMinutes(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(utcDate).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - utcDate.getTime()) / 60_000;
}

/** Klucz dnia kalendarzowego "YYYY-MM-DD" w danej strefie. */
export function dayKeyInZone(timeZone: string, utcDate: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate);
}

/** Dzień tygodnia (0 = niedziela … 6 = sobota) w danej strefie. */
export function weekdayInZone(timeZone: string, utcDate: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(
    utcDate,
  );
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/**
 * Zamienia (dzień w strefie, minuty od północy) na moment UTC.
 * Dwuprzebiegowa korekta offsetu radzi sobie ze zmianą czasu letniego.
 */
export function zonedTimeToUtc(
  timeZone: string,
  dayKey: string,
  minutesFromMidnight: number,
): Date {
  const [year = 0, month = 1, day = 1] = dayKey.split("-").map(Number);
  const naive = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minutesFromMidnight / 60),
    minutesFromMidnight % 60,
  );
  let utc = naive - tzOffsetMinutes(timeZone, new Date(naive)) * 60_000;
  utc = naive - tzOffsetMinutes(timeZone, new Date(utc)) * 60_000;
  return new Date(utc);
}

/** Minuty od północy w danej strefie dla wskazanego momentu. */
export function minutesFromMidnightInZone(timeZone: string, utcDate: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(utcDate)
      .map((p) => [p.type, p.value]),
  );
  return (Number(parts.hour) % 24) * 60 + Number(parts.minute);
}

/** Kolejny dzień po danym kluczu "YYYY-MM-DD" (arytmetyka w UTC — bez DST). */
export function nextDayKey(dayKey: string): string {
  const [year = 0, month = 1, day = 1] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

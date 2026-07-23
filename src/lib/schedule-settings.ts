import { z } from "zod";

/** Ustawienia harmonogramu publikacji per konto (JSON w accounts.schedule_settings). */
export const scheduleSettingsSchema = z.object({
  itemsPerDay: z.number().int().min(1).max(50),
  /** Okno godzinowe publikacji, godziny 0-23; start < koniec. */
  windowStartHour: z.number().int().min(0).max(23),
  windowEndHour: z.number().int().min(1).max(24),
  /** Dni tygodnia: 0 = niedziela … 6 = sobota (jak Date.getDay). */
  days: z.array(z.number().int().min(0).max(6)).min(1),
  /** Losowy rozrzut wokół wyliczonego slotu, w minutach. */
  jitterMinutes: z.number().int().min(0).max(180),
});

export type ScheduleSettings = z.infer<typeof scheduleSettingsSchema>;

export function parseScheduleSettings(raw: string | null): ScheduleSettings | null {
  if (!raw) return null;
  try {
    const result = scheduleSettingsSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

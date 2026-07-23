import { db } from "@/db";
import { accounts } from "@/db/schema";
import { config } from "@/lib/config";
import { parseScheduleSettings } from "@/lib/schedule-settings";
import { ScheduleForm, type ScheduleFormAccount } from "./schedule-form";
import { VintedPanel, type VintedAccount } from "./vinted-panel";

export const dynamic = "force-dynamic";

export default async function UstawieniaPage() {
  const accountRows = await db.select().from(accounts);
  const formAccounts: ScheduleFormAccount[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    settings: parseScheduleSettings(a.scheduleSettings),
    maxOpsPerHour: a.maxOpsPerHour,
    maxOpsPerDay: a.maxOpsPerDay,
  }));

  const aiConfigured = Boolean(config.GEMINI_API_KEY);

  const vintedAccounts: VintedAccount[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    sessionStatus: a.sessionStatus,
    hasSession: a.secretRef !== null,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">Ustawienia</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Konfiguracja aplikacji. Klucze API i sekrety trzymane są wyłącznie w
          zmiennych środowiskowych — nigdy w bazie ani w tym ekranie.
        </p>
      </div>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Środowisko</h2>
        <ul className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <li className="flex justify-between py-1">
            <span>Strefa czasowa (okna publikacji, kalendarz)</span>
            <span className="font-mono">{config.APP_TIMEZONE}</span>
          </li>
          <li className="flex justify-between py-1">
            <span>Generowanie AI (Gemini)</span>
            <span>
              {aiConfigured ? (
                <span className="text-green-700 dark:text-green-400">skonfigurowane</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  brak klucza (GEMINI_API_KEY)
                </span>
              )}
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Harmonogram publikacji</h2>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Dla każdego konta ustaw, ile przedmiotów planować dziennie, w jakim
          oknie godzinowym i w jakie dni. Rozrzut losowy rozkłada publikacje w
          czasie; twarde limity per konto są respektowane przy generowaniu planu.
        </p>
        {formAccounts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Brak kont — dodaj konto w zakładce Konta, aby ustawić jego harmonogram.
          </p>
        ) : (
          <div className="space-y-4">
            {formAccounts.map((account) => (
              <ScheduleForm key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      <VintedPanel accounts={vintedAccounts} />
    </div>
  );
}

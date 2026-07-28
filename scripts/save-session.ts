/**
 * Przechwycenie sesji Vinted i zapis do bazy (zaszyfrowanej).
 *
 * PO CO TO: worker w chmurze nie ma ekranu, więc nie zalogujesz się tam ręcznie.
 * Logujesz się RAZ tutaj, na swoim komputerze, a ciasteczka sesji trafiają
 * zaszyfrowane (AES-256-GCM) do tej samej bazy, z której korzysta worker.
 *
 * URUCHOMIENIE:
 *   npm run zapisz-sesje
 *   npm run zapisz-sesje -- --account 3
 */

import "dotenv/config";
import readline from "node:readline/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { chromium } from "playwright";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { setAccountSession } from "@/lib/vinted-session-service";
import selectors from "../vinted-selectors.json";

/** Osobny profil per konto — dzięki temu każde konto ma własną, niezależną sesję. */
function profileDir(accountId: number): string {
  return path.resolve(process.cwd(), "data", "vinted-profile", String(accountId));
}

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function pickAccount(argv: string[]): Promise<typeof accounts.$inferSelect | null> {
  const idx = argv.indexOf("--account");
  const explicitId = idx >= 0 && argv[idx + 1] ? Number(argv[idx + 1]) : null;
  if (explicitId !== null && Number.isFinite(explicitId)) {
    const [row] = await db.select().from(accounts).where(eq(accounts.id, explicitId));
    return row ?? null;
  }

  const all = await db.select().from(accounts);
  if (all.length === 0) {
    console.log("Brak kont w aplikacji. Dodaj konto w zakładce Konta i spróbuj ponownie.");
    return null;
  }
  if (all.length === 1) return all[0] ?? null;

  console.log("\nDla którego konta zapisać sesję?");
  for (const account of all) {
    console.log(`  ${account.id}) ${account.name}  [tryb: ${account.adapter}]`);
  }
  const answer = await ask("Numer konta: ");
  const [row] = await db.select().from(accounts).where(eq(accounts.id, Number(answer)));
  return row ?? null;
}

async function main(): Promise<void> {
  const account = await pickAccount(process.argv.slice(2));
  if (!account) {
    console.log("Nie wybrano konta — przerywam.");
    return;
  }

  console.log("");
  console.log("═══ Zapis sesji Vinted ═══");
  console.log(`Konto: ${account.name}`);

  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launchPersistentContext(profileDir(account.id), {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ...(executablePath ? { executablePath } : {}),
  });
  const page = browser.pages()[0] ?? (await browser.newPage());

  try {
    await page.goto(selectors.baseUrl, { waitUntil: "domcontentloaded" });

    const isLoggedIn = async (): Promise<boolean> => {
      try {
        await page.locator(selectors.loggedInMarker).first().waitFor({ timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    };

    if (!(await isLoggedIn())) {
      console.log("");
      console.log("┌──────────────────────────────────────────────────────────────┐");
      console.log("│  ZALOGUJ SIĘ NA VINTED W OTWARTYM OKNIE                       │");
      console.log("│  Skrypt poczeka i sam wykryje, że się udało.                  │");
      console.log("└──────────────────────────────────────────────────────────────┘");
      console.log("");

      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      let ok = false;
      while (Date.now() < deadline) {
        if (await isLoggedIn()) {
          ok = true;
          break;
        }
        await page.waitForTimeout(2000);
      }
      if (!ok) throw new Error("Nie wykryto zalogowania w ciągu 10 minut.");
    }

    console.log("✓ Zalogowano — przechwytuję sesję…");

    const cookies = await browser.cookies();
    if (cookies.length === 0) {
      throw new Error("Nie udało się odczytać ciasteczek sesji.");
    }

    await setAccountSession(account.id, JSON.stringify(cookies));

    console.log("");
    console.log(`✓ Sesja zapisana w bazie — ZASZYFROWANA (AES-256-GCM).`);
    console.log(`  Ciasteczek: ${cookies.length}`);
    console.log("");
    console.log("Worker w chmurze może już z niej korzystać.");
    console.log("Gdy sesja wygaśnie, aplikacja zatrzyma kolejkę i poprosi o powtórzenie");
    console.log("tego polecenia — nic nie posypie się kaskadą błędów.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("\nBŁĄD:", (error as Error).message);
  process.exit(1);
});

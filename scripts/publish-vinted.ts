/**
 * Lokalny publikator Vinted — sterowanie prawdziwą przeglądarką.
 *
 * DLACZEGO TAK, A NIE PRZEZ API: Vinted nie udostępnia publicznego API, więc
 * jedyny uczciwy sposób publikacji to wypełnienie tego samego formularza, który
 * wypełniłby człowiek. Skrypt nie podszywa się pod nic — otwiera normalną
 * przeglądarkę, w której logujesz się własnymi danymi, i klika za Ciebie.
 *
 * DLACZEGO LOKALNIE: Vercel (serwer w chmurze) nie uruchomi przeglądarki.
 * Magazyn i harmonogram żyją w chmurze, publikacja odpala się z Twojego
 * komputera i sięga do tej samej bazy.
 *
 * URUCHOMIENIE:
 *   npm run publikuj              — tryb przeglądu (domyślny, zalecany)
 *   npm run publikuj -- --auto    — skrypt sam klika "Wystaw"
 *   npm run publikuj -- --listing 12   — tylko jedno konkretne ogłoszenie
 */

import "dotenv/config"; // wczytuje .env — skrypt działa poza Next.js
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { and, asc, eq, inArray } from "drizzle-orm";
import { chromium, type Page } from "playwright";
import { db } from "@/db";
import { accounts, items, listings, photos } from "@/db/schema";
import { TokenBucket } from "@/adapters/vinted/token-bucket";
import { groszeToInputValue } from "@/domain/finance/money";
import { logEvent } from "@/lib/event-log";
import { getAccountSession, markSessionExpired } from "@/lib/vinted-session-service";
import { normalizeSessionInput } from "@/lib/vinted-cookies";
import { getStorage } from "@/storage";
import selectorsJson from "../vinted-selectors.json";

/** Osobny profil przeglądarki per konto — inaczej konta wylogowywałyby się nawzajem. */
function profileDir(accountId: number): string {
  return path.resolve(process.cwd(), "data", "vinted-profile", String(accountId));
}

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

// Konserwatywnie: jedno wystawienie na ~30 s. Pośpiech to najkrótsza droga do bana.
const RATE_CAPACITY = 2;
const RATE_REFILL_PER_SEC = 1 / 30;

interface Args {
  auto: boolean;
  listingId: number | null;
  /** Tryb workera: bez ekranu, sesja z bazy, zero pytań do człowieka. */
  worker: boolean;
}

function parseArgs(argv: string[]): Args {
  // WORKER_MODE=1 ustawia kontener w chmurze (patrz render.yaml).
  const worker = argv.includes("--worker") || process.env.WORKER_MODE === "1";
  const idx = argv.indexOf("--listing");
  const listingId = idx >= 0 && argv[idx + 1] ? Number(argv[idx + 1]) : null;
  return {
    // W chmurze nie ma kto kliknąć „Wystaw", więc worker zawsze działa automatycznie.
    auto: argv.includes("--auto") || worker,
    listingId: Number.isFinite(listingId) ? listingId : null,
    worker,
  };
}

function log(msg: string): void {
  console.log(msg);
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** Ogłoszenia gotowe do wystawienia: szkice na kontach w trybie "vinted". */
async function findListingsToPublish(listingId: number | null) {
  if (listingId !== null) {
    const [row] = await db.select().from(listings).where(eq(listings.id, listingId));
    return row ? [row] : [];
  }
  const vintedAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.adapter, "vinted"));
  if (vintedAccounts.length === 0) return [];
  return db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.status, "draft"),
        inArray(
          listings.accountId,
          vintedAccounts.map((a) => a.id),
        ),
      ),
    )
    .orderBy(asc(listings.id));
}

/** Pobiera zdjęcia przedmiotu na dysk tymczasowy — formularz przyjmuje pliki, nie adresy. */
async function downloadPhotos(itemId: number, dir: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.itemId, itemId))
    .orderBy(asc(photos.position));
  const storage = getStorage();
  const files: string[] = [];
  for (const [i, photo] of rows.entries()) {
    try {
      const buf = await storage.get(photo.processedKey ?? photo.originalKey);
      const file = path.join(dir, `zdjecie-${i + 1}.jpg`);
      await writeFile(file, buf);
      files.push(file);
    } catch (error) {
      log(`   ! nie udało się pobrać zdjęcia ${i + 1}: ${(error as Error).message}`);
    }
  }
  return files;
}

/** Wypełnia jedno pole; brak selektora nie przerywa pracy — zgłasza i idzie dalej. */
async function fillField(
  page: Page,
  selector: string,
  value: string,
  label: string,
  missing: string[],
): Promise<void> {
  if (value === "") return;
  try {
    const field = page.locator(selector).first();
    await field.waitFor({ state: "visible", timeout: 5000 });
    await field.fill(value);
    log(`   ✓ ${label}`);
  } catch {
    missing.push(label);
    log(`   ! ${label} — nie znalazłem pola, uzupełnij ręcznie`);
  }
}

/** Klasa błędu: sesja nie działa — kolejka ma zostać zatrzymana, nie zalana błędami. */
class SessionInvalidError extends Error {
  constructor(public readonly accountId: number) {
    super("Sesja Vinted nie działa — wymagane odnowienie.");
    this.name = "SessionInvalidError";
  }
}

async function waitForLogin(
  page: Page,
  selectors: typeof selectorsJson,
  args: Args,
  accountId: number,
): Promise<void> {
  await page.goto(selectors.baseUrl, { waitUntil: "domcontentloaded" });

  const isLoggedIn = async (): Promise<boolean> => {
    try {
      await page.locator(selectors.loggedInMarker).first().waitFor({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  };

  if (await isLoggedIn()) {
    log("✓ Zalogowany na Vinted.");
    return;
  }

  // W chmurze nie ma kto się zalogować — sesja z bazy jest jedynym źródłem.
  if (args.worker) {
    throw new SessionInvalidError(accountId);
  }

  log("");
  log("┌──────────────────────────────────────────────────────────────┐");
  log("│  ZALOGUJ SIĘ NA VINTED W OTWARTYM OKNIE PRZEGLĄDARKI          │");
  log("│                                                              │");
  log("│  Wpisz swój e-mail i hasło tak jak zwykle. Skrypt poczeka.    │");
  log("│  Sesja zostanie zapamiętana — następnym razem logowanie       │");
  log("│  nie będzie już potrzebne.                                    │");
  log("└──────────────────────────────────────────────────────────────┘");
  log("");

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isLoggedIn()) {
      log("✓ Zalogowano. Sesja zapamiętana.");
      return;
    }
    await page.waitForTimeout(2000);
  }
  throw new Error("Nie wykryto zalogowania w ciągu 10 minut — przerywam.");
}

async function publishOne(
  page: Page,
  selectors: typeof selectorsJson,
  listing: typeof listings.$inferSelect,
  auto: boolean,
): Promise<"published" | "skipped"> {
  const [item] = await db.select().from(items).where(eq(items.id, listing.itemId));
  const [account] = await db.select().from(accounts).where(eq(accounts.id, listing.accountId));
  if (!item || !account) {
    log(`   ! brak przedmiotu lub konta — pomijam`);
    return "skipped";
  }

  log("");
  log(`── Ogłoszenie #${listing.id}: „${listing.title}" (konto: ${account.name})`);

  await logEvent({
    actor: "app",
    account: account.name,
    action: "vinted.publish.start",
    outcome: "ok",
    detail: `Rozpoczęto wystawianie ogłoszenia #${listing.id} przez przeglądarkę`,
  });

  const tmp = await mkdtemp(path.join(tmpdir(), "vinted-"));
  const missing: string[] = [];

  try {
    await page.goto(selectors.sellUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Zdjęcia
    const files = await downloadPhotos(item.id, tmp);
    if (files.length > 0) {
      try {
        await page.locator(selectors.fields.photos).first().setInputFiles(files);
        log(`   ✓ zdjęcia (${files.length})`);
        await page.waitForTimeout(3000); // czas na wgranie
      } catch {
        missing.push("zdjęcia");
        log("   ! zdjęcia — nie znalazłem pola, wgraj ręcznie");
      }
    }

    // Pola tekstowe
    await fillField(page, selectors.fields.title, listing.title, "tytuł", missing);
    await fillField(page, selectors.fields.description, listing.description ?? "", "opis", missing);
    await fillField(
      page,
      selectors.fields.price,
      listing.priceGr !== null ? groszeToInputValue(listing.priceGr) : "",
      "cena",
      missing,
    );

    // Pola wyboru zostawiamy człowiekowi — źle dobrana kategoria to martwe ogłoszenie.
    log("");
    log("   Do wyklikania ręcznie w przeglądarce:");
    log(`     kategoria: ${item.category ?? "—"}`);
    log(`     marka:     ${item.brand ?? "—"}`);
    log(`     rozmiar:   ${item.size ?? "—"}`);
    log(`     stan:      ${item.condition ?? "—"}`);
    if (missing.length > 0) {
      log(`   Dodatkowo uzupełnij: ${missing.join(", ")}`);
    }

    if (!auto) {
      log("");
      const answer = await ask(
        "   Sprawdź formularz w przeglądarce, uzupełnij resztę i kliknij „Wystaw”.\n" +
          "   Gotowe? [t = wystawione / p = pomiń]: ",
      );
      if (answer.toLowerCase() !== "t") {
        log("   → pominięto");
        await logEvent({
          actor: "user",
          account: account.name,
          action: "vinted.publish.skipped",
          outcome: "ok",
          detail: `Pominięto ogłoszenie #${listing.id}`,
        });
        return "skipped";
      }
    } else {
      try {
        await page.locator(selectors.submitButton).first().click();
        await page.waitForTimeout(5000);
        log("   ✓ kliknięto „Wystaw”");
      } catch {
        log("   ! nie znalazłem przycisku wysyłki — dokończ ręcznie");
        await ask("   Naciśnij Enter, gdy ogłoszenie będzie wystawione: ");
      }
    }

    const url = page.url();
    const externalId = url.includes("/items/") && !url.includes("/items/new") ? url : null;

    await db
      .update(listings)
      .set({
        status: "published",
        publishedAt: new Date().toISOString(),
        refreshedAt: new Date().toISOString(),
        externalId,
        createdVia: "adapter",
      })
      .where(eq(listings.id, listing.id));
    await db.update(items).set({ status: "listed" }).where(eq(items.id, item.id));

    await logEvent({
      actor: "app",
      account: account.name,
      action: "vinted.publish.ok",
      outcome: "ok",
      detail: `Wystawiono ogłoszenie #${listing.id}${externalId ? ` (${externalId})` : ""}`,
      payload: { listingId: listing.id, externalId },
    });

    log(`   ✓ zapisano jako wystawione`);
    return "published";
  } catch (error) {
    const message = (error as Error).message;
    log(`   ✗ błąd: ${message}`);
    await logEvent({
      actor: "app",
      account: account.name,
      action: "vinted.publish.error",
      outcome: "error",
      detail: `Ogłoszenie #${listing.id}: ${message}`,
    });
    return "skipped";
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Sesja padła: zatrzymujemy kolejkę konta i prosimy o odnowienie, zamiast tłuc
 * w platformę kolejnymi nieudanymi próbami (kaskada błędów = szybszy ban).
 */
async function handleDeadSession(accountId: number, reason: string): Promise<void> {
  const { pausedJobs } = await markSessionExpired(accountId);
  log("");
  log(`✗ SESJA VINTED NIE DZIAŁA (${reason}) — zatrzymano kolejkę tego konta.`);
  log(`  Wstrzymanych zadań: ${pausedJobs}`);
  log("  Odnów sesję na swoim komputerze: npm run zapisz-sesje");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const selectors = selectorsJson;

  log("");
  log(args.worker ? "═══ Publikator Vinted (worker w chmurze) ═══" : "═══ Publikator Vinted (lokalny) ═══");
  log(args.auto ? "Tryb: AUTOMATYCZNY" : "Tryb: PRZEGLĄD (Ty klikasz „Wystaw”)");

  const toPublish = await findListingsToPublish(args.listingId);
  if (toPublish.length === 0) {
    log("");
    log("Brak ogłoszeń do wystawienia.");
    if (!args.worker) {
      log("Podpowiedź: w aplikacji ustaw konto na tryb „Vinted automatyczny”,");
      log("a potem na karcie przedmiotu kliknij „Przygotuj ogłoszenie”.");
    }
    return;
  }

  // Grupowanie po kontach: KAŻDE konto dostaje własną przeglądarkę i własną
  // sesję. Wspólna sesja dla wielu kont wystawiłaby cudze ogłoszenia na złym
  // koncie — dlatego konta są tu twardo odseparowane.
  const byAccount = new Map<number, typeof toPublish>();
  for (const listing of toPublish) {
    const group = byAccount.get(listing.accountId) ?? [];
    group.push(listing);
    byAccount.set(listing.accountId, group);
  }

  log(
    `Znaleziono ogłoszeń: ${toPublish.length} na ${byAccount.size} ${
      byAccount.size === 1 ? "koncie" : "kontach"
    }`,
  );

  // Limiter jest WSPÓLNY dla wszystkich kont — chroni platformę niezależnie od
  // tego, przez ile kont akurat przechodzimy.
  const bucket = new TokenBucket(RATE_CAPACITY, RATE_REFILL_PER_SEC);
  let publishedTotal = 0;

  for (const [accountId, accountListings] of byAccount) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
    log("");
    log(`━━ Konto: ${account?.name ?? `#${accountId}`} (${accountListings.length} do wystawienia)`);

    const published = await publishForAccount(
      accountId,
      accountListings,
      selectors,
      args,
      bucket,
    );
    publishedTotal += published;
  }

  log("");
  log(`═══ Koniec. Wystawiono łącznie: ${publishedTotal} z ${toPublish.length} ═══`);
}

/**
 * Publikuje ogłoszenia JEDNEGO konta we własnej przeglądarce.
 * Padnięta sesja zatrzymuje kolejkę tylko tego konta — pozostałe konta
 * są przetwarzane dalej, bo ich sesje mogą być zupełnie sprawne.
 */
async function publishForAccount(
  accountId: number,
  accountListings: (typeof listings.$inferSelect)[],
  selectors: typeof selectorsJson,
  args: Args,
  bucket: TokenBucket,
): Promise<number> {
  // CHROMIUM_PATH pozwala wskazać własną przeglądarkę (np. zainstalowanego Chrome),
  // zamiast pobierać osobną przez "npx playwright install chromium".
  const executablePath = process.env.CHROMIUM_PATH;
  const launchOpts = { ...(executablePath ? { executablePath } : {}) };

  // Worker: sesja z bazy (zaszyfrowana). Sprawdzamy JĄ NAJPIERW — zanim
  // uruchomimy przeglądarkę — żeby brak sesji od razu zatrzymał kolejkę konta.
  let cookies: Awaited<ReturnType<typeof getSessionCookies>> = null;
  if (args.worker) {
    cookies = await getSessionCookies(accountId);
    if (cookies === null) {
      await handleDeadSession(accountId, "brak zapisanej lub uszkodzona sesja");
      return 0;
    }
  }

  const browser = args.worker
    ? await (async () => {
        const b = await chromium.launch({ headless: true, ...launchOpts });
        const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
        if (cookies) await ctx.addCookies(cookies);
        return ctx;
      })()
    : // Lokalnie: osobny profil per konto, żeby dało się być zalogowanym
      // na kilku kontach naraz bez wzajemnego wylogowywania.
      await chromium.launchPersistentContext(profileDir(accountId), {
        headless: false,
        viewport: { width: 1280, height: 900 },
        ...launchOpts,
      });

  const page = browser.pages()[0] ?? (await browser.newPage());
  let published = 0;

  try {
    await waitForLogin(page, selectors, args, accountId);

    for (const listing of accountListings) {
      const wait = bucket.msUntilAvailable();
      if (wait > 0) {
        log(`\n(odczekuję ${Math.ceil(wait / 1000)} s — limit tempa)`);
        await page.waitForTimeout(wait);
      }
      bucket.tryRemove();

      const result = await publishOne(page, selectors, listing, args.auto);
      if (result === "published") published += 1;
    }
  } catch (error) {
    if (error instanceof SessionInvalidError) {
      await handleDeadSession(error.accountId, "sesja odrzucona przez Vinted");
      return published;
    }
    throw error;
  } finally {
    if (!args.worker) {
      await ask("Naciśnij Enter, aby zamknąć przeglądarkę tego konta: ");
    }
    const underlying = browser.browser();
    await browser.close();
    await underlying?.close();
  }

  return published;
}

/** Odszyfrowane ciasteczka sesji konta; null gdy brak lub uszkodzone. */
async function getSessionCookies(accountId: number) {
  const raw = await getAccountSession(accountId);
  if (!raw) return null;
  // Normalizator przyjmuje zarówno JSON, jak i nagłówek Cookie wklejony ręcznie.
  return normalizeSessionInput(raw);
}

main().catch((error) => {
  console.error("\nBŁĄD:", (error as Error).message);
  process.exit(1);
});

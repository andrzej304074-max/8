/**
 * Zdalna przeglądarka Vinted — wszystko dzieje się na serwerze.
 *
 * Wchodzisz na adres usługi, widzisz w oknie przeglądarki DRUGĄ przeglądarkę,
 * która działa na serwerze. Logujesz się w niej na Vinted i klikasz „Zapisz
 * sesję". Od tej chwili worker publikuje ogłoszenia bez Twojego udziału.
 * Na Twoim komputerze nie trzeba instalować niczego.
 *
 * Jak to jest poskładane:
 *   Xvfb        — wirtualny ekran (serwer nie ma monitora)
 *   Chromium    — prawdziwa przeglądarka rysująca na tym ekranie
 *   x11vnc      — udostępnia ten ekran
 *   websockify  — podaje obraz do przeglądarki przez WebSocket (noVNC)
 *   ten serwer  — panel, logowanie hasłem i pośrednictwo do noVNC
 */

import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { eq } from "drizzle-orm";
import { chromium, type BrowserContext } from "playwright";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { config } from "@/lib/config";
import { logEvent } from "@/lib/event-log";
import { setAccountSession } from "@/lib/vinted-session-service";
import selectors from "../vinted-selectors.json";

const PORT = Number(process.env.PORT ?? 10000);
const NOVNC_PORT = Number(process.env.NOVNC_PORT ?? 6080);
const AUTH_COOKIE = "vm_remote";

/** Token uwierzytelniający — wyprowadzony z sekretu, nie trzymamy nic w pamięci. */
function authToken(): string {
  return createHmac("sha256", config.SESSION_SECRET).update("remote-panel").digest("hex");
}

function isAuthed(req: http.IncomingMessage): boolean {
  const raw = req.headers.cookie ?? "";
  const match = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  if (!match) return false;
  const given = Buffer.from(match.slice(AUTH_COOKIE.length + 1));
  const expected = Buffer.from(authToken());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ─── Zdalna przeglądarka ────────────────────────────────────────────────────

let browser: BrowserContext | null = null;

async function getBrowser(): Promise<BrowserContext> {
  if (browser) return browser;
  // headless: false — przeglądarka MUSI rysować na wirtualnym ekranie,
  // inaczej nie byłoby czego pokazać przez VNC.
  browser = await chromium.launchPersistentContext(
    path.resolve(process.cwd(), "data", "remote-profile"),
    {
      headless: false,
      viewport: null,
      args: [
        "--window-position=0,0",
        "--window-size=1280,900",
        "--no-first-run",
        // Kontener ma mało pamięci współdzielonej (/dev/shm) — bez tego
        // Chromium potrafi się wywalić przy pierwszej cięższej stronie.
        "--disable-dev-shm-usage",
        // W kontenerze nie ma karty graficznej ani piaskownicy jądra.
        "--disable-gpu",
        "--no-sandbox",
        // Mniej procesów w tle = mniej zużytej pamięci na małym planie.
        "--disable-extensions",
        "--disable-background-networking",
      ],
    },
  );
  const page = browser.pages()[0] ?? (await browser.newPage());
  await page.goto(selectors.baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  return browser;
}

async function currentPage() {
  const ctx = await getBrowser();
  return ctx.pages()[0] ?? (await ctx.newPage());
}

// ─── Panel ──────────────────────────────────────────────────────────────────

function html(body: string): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zdalna przeglądarka Vinted</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;background:#18181b;color:#fafafa}
 .wrap{max-width:1400px;margin:0 auto;padding:16px}
 h1{font-size:18px;margin:0 0 12px}
 .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
 button,select,input{font:inherit;padding:8px 12px;border-radius:6px;border:1px solid #3f3f46;
   background:#27272a;color:#fafafa}
 button{cursor:pointer;background:#fafafa;color:#18181b;font-weight:600;border:none}
 button.ghost{background:#27272a;color:#fafafa;border:1px solid #3f3f46;font-weight:400}
 iframe{width:100%;height:78vh;border:1px solid #3f3f46;border-radius:8px;background:#000}
 .msg{padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:14px}
 .ok{background:#052e16;color:#86efac}.err{background:#450a0a;color:#fca5a5}
 .hint{color:#a1a1aa;font-size:13px;line-height:1.5}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function loginPage(error = "", next = "/"): string {
  // Zachowujemy adres docelowy, żeby po zalogowaniu wrócić do właściwego konta
  // (wejście z sekcji Konta ma postać /?account=3).
  const safeNext = next.startsWith("/") ? next : "/";
  return html(`<h1>Zdalna przeglądarka Vinted</h1>
${error ? `<div class="msg err">${error}</div>` : ""}
<form method="POST" action="/login">
  <p class="hint">Podaj hasło do aplikacji (to samo co w APP_PASSWORD).</p>
  <input type="hidden" name="next" value="${safeNext.replace(/"/g, "&quot;")}">
  <div class="bar">
    <input type="password" name="password" placeholder="hasło" autofocus>
    <button type="submit">Wejdź</button>
  </div>
</form>`);
}

function panelPage(
  accountList: { id: number; name: string }[],
  preselectedId: number | null,
): string {
  const options = accountList
    .map(
      (a) =>
        `<option value="${a.id}"${a.id === preselectedId ? " selected" : ""}>${a.name}</option>`,
    )
    .join("");
  const preselected = accountList.find((a) => a.id === preselectedId);
  return html(`<h1>Logowanie do Vinted${
    preselected ? ` — konto: ${preselected.name}` : ""
  }</h1>
<div id="msg"></div>
<p class="hint">
  Poniżej widzisz przeglądarkę działającą <strong>na serwerze</strong>.
  Zaloguj się w niej na Vinted (klikaj i pisz tak jak zwykle), a potem kliknij
  <strong>„Zapisz sesję”</strong>. Od tej chwili ogłoszenia będą wystawiane
  automatycznie${preselected ? ` na koncie <strong>${preselected.name}</strong>` : ""}.
</p>
<div class="bar">
  <button class="ghost" onclick="post('/api/otworz-vinted')">Otwórz Vinted</button>
  <select id="acc">${options}</select>
  <button onclick="post('/api/zapisz-sesje?account='+document.getElementById('acc').value)">
    Zapisz sesję
  </button>
  <button class="ghost" onclick="post('/api/publikuj')">Opublikuj oczekujące</button>
</div>
<iframe src="/vnc/vnc.html?autoconnect=1&resize=scale&path=vnc/websockify"></iframe>
<script>
async function post(url){
  const box=document.getElementById('msg');
  box.className='msg';box.textContent='Pracuję…';
  try{
    const r=await fetch(url,{method:'POST'});
    const t=await r.text();
    box.className='msg '+(r.ok?'ok':'err');box.textContent=t;
  }catch(e){box.className='msg err';box.textContent='Błąd: '+e.message;}
}
</script>`);
}

// ─── Pośrednictwo do noVNC ──────────────────────────────────────────────────

function proxyHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
  const target = req.url!.replace(/^\/vnc/, "") || "/";
  const proxyReq = http.request(
    { host: "127.0.0.1", port: NOVNC_PORT, path: target, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => {
    res.writeHead(502).end("Podgląd przeglądarki jeszcze się uruchamia — odśwież za chwilę.");
  });
  req.pipe(proxyReq);
}

// ─── Serwer ─────────────────────────────────────────────────────────────────

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // Logowanie do panelu
  if (url.pathname === "/login" && req.method === "POST") {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    const password = params.get("password") ?? "";
    // Tylko adresy względne — bez tego dałoby się przekierować użytkownika
    // na obcą stronę po zalogowaniu.
    const rawNext = params.get("next") ?? "/";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
    if (password === config.APP_PASSWORD) {
      res.writeHead(302, {
        "Set-Cookie": `${AUTH_COOKIE}=${authToken()}; HttpOnly; Path=/; SameSite=Lax`,
        Location: next,
      }).end();
    } else {
      res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" })
        .end(loginPage("Nieprawidłowe hasło.", next));
    }
    return;
  }

  if (!isAuthed(req)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(loginPage("", req.url ?? "/"));
    return;
  }

  // Podgląd przeglądarki
  if (url.pathname.startsWith("/vnc")) {
    proxyHttp(req, res);
    return;
  }

  if (url.pathname === "/" && req.method === "GET") {
    const rows = await db.select().from(accounts).where(eq(accounts.adapter, "vinted"));
    const list = rows.length > 0 ? rows : await db.select().from(accounts);
    // ?account=N przychodzi z sekcji Konta w aplikacji — od razu wybieramy to konto.
    const requested = Number(url.searchParams.get("account"));
    const preselected = Number.isInteger(requested) && requested > 0 ? requested : null;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      .end(panelPage(list.map((a) => ({ id: a.id, name: a.name })), preselected));
    return;
  }

  if (url.pathname === "/api/otworz-vinted" && req.method === "POST") {
    try {
      const page = await currentPage();
      await page.goto(selectors.baseUrl, { waitUntil: "domcontentloaded" });
      res.writeHead(200).end("Otwarto Vinted — zaloguj się w oknie poniżej.");
    } catch (error) {
      res.writeHead(500).end(`Nie udało się otworzyć: ${(error as Error).message}`);
    }
    return;
  }

  if (url.pathname === "/api/zapisz-sesje" && req.method === "POST") {
    const accountId = Number(url.searchParams.get("account"));
    if (!Number.isInteger(accountId) || accountId <= 0) {
      res.writeHead(400).end("Nie wybrano konta.");
      return;
    }
    try {
      const ctx = await getBrowser();
      const cookies = await ctx.cookies();
      if (cookies.length === 0) {
        res.writeHead(400).end("Brak ciasteczek — najpierw zaloguj się na Vinted w oknie poniżej.");
        return;
      }
      await setAccountSession(accountId, JSON.stringify(cookies));
      res.writeHead(200).end(
        `Zapisano sesję (${cookies.length} ciasteczek), zaszyfrowaną. Worker może już publikować.`,
      );
    } catch (error) {
      res.writeHead(500).end(`Błąd zapisu sesji: ${(error as Error).message}`);
    }
    return;
  }

  if (url.pathname === "/api/publikuj" && req.method === "POST") {
    try {
      // Publikator uruchamiamy jako osobny proces — nie blokuje panelu
      // i nie przewraca serwera, gdyby coś w nim padło.
      const { spawn } = await import("node:child_process");
      const child = spawn("npm", ["run", "worker"], {
        stdio: "inherit",
        env: { ...process.env, WORKER_MODE: "1" },
      });
      child.unref();
      await logEvent({
        actor: "user",
        action: "remote.publish.triggered",
        outcome: "ok",
        detail: "Publikacja uruchomiona z panelu zdalnej przeglądarki",
      });
      res.writeHead(200).end("Uruchomiono publikację. Postęp zobaczysz w Historii w aplikacji.");
    } catch (error) {
      res.writeHead(500).end(`Nie udało się uruchomić: ${(error as Error).message}`);
    }
    return;
  }

  res.writeHead(404).end("Nie znaleziono");
});

// Podgląd obrazu leci WebSocketem — musimy przepuścić też połączenia „upgrade".
server.on("upgrade", (req, socket, head) => {
  if (!isAuthed(req) || !req.url?.startsWith("/vnc")) {
    socket.destroy();
    return;
  }
  const target = req.url.replace(/^\/vnc/, "") || "/";
  const upstream = net.connect(NOVNC_PORT, "127.0.0.1", () => {
    upstream.write(
      `GET ${target} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(",") : v}\r\n`)
          .join("") +
        "\r\n",
    );
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.listen(PORT, () => {
  console.log(`Panel zdalnej przeglądarki działa na porcie ${PORT}`);
  // Uruchamiamy przeglądarkę od razu, żeby podgląd był gotowy przy pierwszym wejściu.
  getBrowser().catch((error) => console.error("Nie udało się wystartować przeglądarki:", error));
});

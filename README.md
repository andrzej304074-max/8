# Menedżer Sprzedaży Vinted

Aplikacja webowa do zarządzania sprzedażą odzieży używanej: magazyn przedmiotów,
generowanie ogłoszeń przez AI, harmonogram publikacji i statystyki finansowe.
Projekt architektury: [`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md).

## Stan prac

- [x] **Etap 1 — Fundament**: szkielet aplikacji, schemat bazy z migracjami, logowanie hasłem, ekran Magazynu
- [x] **Etap 2 — Magazyn**: CRUD przedmiotów, zdjęcia z czyszczeniem EXIF (w tym GPS), filtry, siatka/tabela, masowa edycja, widok „zalegające"
- [x] **Etap 3 — Generowanie ogłoszeń przez AI**: Gemini (darmowy plan), walidacja Zod z ponowną próbą, cache po hashu zdjęć, formularz akceptacji
- [x] **Etap 4 — ManualAdapter i DryRunAdapter**: konta, paczka do ręcznego wklejenia, tryb dry run, dziennik EventLog w Historii
- [ ] Etap 5 — Scheduler i kolejka zadań
- [ ] Etap 6 — Silnik reguł relistingu
- [ ] Etap 7 — Statystyki i eksporty
- [ ] Etap 8 — VintedAdapter

---

## Uruchomienie na własnym komputerze — krok po kroku

### Krok 1: Zainstaluj Node.js (jeśli jeszcze nie masz)

1. Wejdź na <https://nodejs.org/>
2. Pobierz wersję **LTS** (przycisk po lewej) i zainstaluj, klikając „Dalej" aż do końca.
3. Sprawdź, czy działa: otwórz terminal
   (Windows: menu Start → wpisz `cmd` → Enter; macOS: aplikacja Terminal)
   i wpisz:

   ```
   node --version
   ```

   Jeśli zobaczysz numer wersji (np. `v22.x.x`) — jest dobrze. Potrzebna wersja to 20 lub nowsza.

### Krok 2: Pobierz projekt

Jeśli masz już folder z projektem — przejdź do kroku 3. Jeśli nie:

```
git clone https://github.com/andrzej304074-max/8.git vinted-manager
cd vinted-manager
```

(Jeśli komenda `git` nie działa, zainstaluj Git z <https://git-scm.com/> — również klikając „Dalej".)

### Krok 3: Zainstaluj zależności projektu

W terminalu, będąc w folderze projektu:

```
npm install
```

To potrwa minutę lub dwie — pobierane są biblioteki, z których korzysta aplikacja.

### Krok 4: Utwórz plik konfiguracyjny `.env`

Aplikacja czyta ustawienia z pliku `.env`, którego **nie ma w repozytorium**
(bo zawiera Twoje hasła). Tworzysz go raz, kopiując wzór:

- Windows (cmd): `copy .env.example .env`
- macOS/Linux: `cp .env.example .env`

Następnie otwórz plik `.env` w Notatniku i uzupełnij dwie wartości:

1. **`APP_PASSWORD`** — hasło, którym będziesz logować się do aplikacji. Wymyśl własne, minimum 8 znaków.
2. **`SESSION_SECRET`** — losowy ciąg minimum 32 znaków. Wygenerujesz go komendą:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Skopiuj wynik i wklej między cudzysłowy.

`DATABASE_URL` zostaw bez zmian — lokalnie baza to zwykły plik `data/dev.db`.

### Krok 5: Utwórz bazę danych

```
npm run db:migrate
```

Ta komenda tworzy plik bazy i wszystkie tabele. Uruchamiasz ją też po każdej
aktualizacji projektu, która zmienia schemat bazy — jest bezpieczna, niczego nie kasuje.

### Krok 6: Uruchom aplikację

```
npm run dev
```

Gdy zobaczysz `Ready`, otwórz w przeglądarce: **<http://localhost:3000>**

Zaloguj się hasłem, które ustawiłeś w `APP_PASSWORD`. Zatrzymanie aplikacji: `Ctrl+C` w terminalu.

---

## Wdrożenie na Vercel (aplikacja dostępna z internetu)

Do działania w chmurze potrzebna jest baza w chmurze — używamy **Turso**
(SQLite w chmurze, darmowy plan wystarczy).

### A. Załóż bazę Turso

1. Wejdź na <https://turso.tech/> i załóż konto (możesz przez GitHub).
2. W panelu kliknij **Create Database**, nadaj nazwę (np. `vinted-manager`), wybierz region Europa.
3. Zanotuj dwie rzeczy z panelu bazy:
   - adres zaczynający się od `libsql://…`
   - token dostępu (**Create Token / Generate Token**)

### B. Podepnij projekt w Vercel

1. Wejdź na <https://vercel.com/> i załóż konto przez GitHub.
2. Kliknij **Add New… → Project** i wybierz to repozytorium.
3. Przed kliknięciem Deploy rozwiń **Environment Variables** i dodaj cztery zmienne:

   | Nazwa | Wartość |
   |---|---|
   | `DATABASE_URL` | adres `libsql://…` z Turso |
   | `DATABASE_AUTH_TOKEN` | token z Turso |
   | `SESSION_SECRET` | losowe 32+ znaki (wygeneruj jak w kroku 4 powyżej — inne niż lokalnie) |
   | `APP_PASSWORD` | hasło logowania do aplikacji |

4. Kliknij **Deploy**. Migracje bazy uruchamiają się automatycznie przy każdym wdrożeniu.
5. Po chwili dostaniesz adres w rodzaju `https://twoja-nazwa.vercel.app` — otwórz go i zaloguj się.

> Uwaga: Vercel wdraża domyślną gałąź repozytorium (zwykle `main`). Jeśli praca
> trwa na innej gałęzi, najpierw scal ją do `main`.

---

## Przydatne komendy

| Komenda | Co robi |
|---|---|
| `npm run dev` | Uruchamia aplikację lokalnie (tryb deweloperski) |
| `npm run db:migrate` | Tworzy/aktualizuje tabele w bazie |
| `npm test` | Uruchamia testy logiki domenowej |
| `npm run build` | Buduje wersję produkcyjną (sprawdza też typy) |

## Generowanie ogłoszeń przez AI (Gemini)

Aplikacja wysyła zdjęcia przedmiotu do modelu wizyjnego Google Gemini i dostaje
propozycję ogłoszenia: tytuł, opis, markę (z poziomem pewności), kategorię,
rozmiar, stan, kolory, materiał, sugerowaną cenę oraz **listę wykrytych wad** —
nic nie zapisuje się bez Twojej akceptacji w formularzu.

### Jak zdobyć darmowy klucz (bez karty płatniczej)

1. Wejdź na <https://aistudio.google.com> i zaloguj się kontem Google.
2. Kliknij **Get API key** → **Create API key**.
3. Skopiuj klucz i wklej do pliku `.env` jako wartość `GEMINI_API_KEY`
   (na Vercel: Settings → Environment Variables → dodaj `GEMINI_API_KEY`).
4. Zrestartuj aplikację (`Ctrl+C` i ponownie `npm run dev`).

Darmowy plan Gemini w zupełności wystarcza — opisanie całego magazynu
150 przedmiotów mieści się w limitach jednego dnia. Wyniki są dodatkowo
cache'owane po hashu zestawu zdjęć, więc ponowne otwarcie tego samego
przedmiotu nie zużywa limitu.

Przycisk „Generuj opis z AI" znajdziesz na karcie przedmiotu (Magazyn → kliknij
przedmiot), pod zdjęciami.

## Publikacja ręczna (paczka do wklejenia)

Zgodnie z regulaminem Vinted aplikacja domyślnie **nie publikuje niczego
automatycznie**. Zamiast tego przygotowuje kompletną paczkę:

1. Dodaj konto w zakładce **Konta** (tryb „Ręczny").
2. Na karcie przedmiotu kliknij **Przygotuj ogłoszenie** — tytuł i opis
   zaciągną się z zaakceptowanej sugestii AI (albo z danych przedmiotu).
3. Na stronie paczki: skopiuj tytuł, opis i cenę przyciskami **Kopiuj**,
   otwórz i zapisz zdjęcia, przejdź checklistę pól (kategoria, stan, rozmiar…),
   sprawdź ostrzeżenia (w tym wykryte przez AI wady).
4. Wklej wszystko w aplikacji/na stronie Vinted i wróć kliknąć
   **„Wkleiłem — oznacz jako opublikowane"** (możesz dodać link do ogłoszenia).
   Status przedmiotu sam zmieni się na „Wystawiony".

Konto w trybie **dry run** niczego nie publikuje — loguje pełny payload do
**Historii**; przyda się do bezpiecznego testowania harmonogramu (Etap 5)
i reguł (Etap 6). Każda operacja zostawia ślad w Historii z rozróżnieniem,
co zrobiła aplikacja, a co Ty.

## Zdjęcia

- Formaty: **JPG, PNG, WebP** (zdjęcia HEIC z iPhone'a: małe pliki przejdą,
  większe wymagają konwersji do JPG — najprościej zrobić zrzut/udostępnienie jako JPG).
- Każde zdjęcie przy zapisie jest skalowane, kompresowane i **czyszczone ze wszystkich
  metadanych EXIF, łącznie ze współrzędnymi GPS** — to zachowanie jest objęte testami
  automatycznymi i nie da się go przypadkiem wyłączyć.
- Lokalnie pliki trafiają do `data/uploads/`, na Vercel — do Vercel Blob
  (w projekcie Vercel: **Storage → Create Database → Blob**; token doda się sam).

## Bezpieczeństwo — co gdzie leży

- **Hasła i tokeny** — tylko w pliku `.env` (lokalnie) lub w zmiennych środowiskowych Vercel. Plik `.env` jest w `.gitignore` i nigdy nie trafia do repozytorium.
- **Baza lokalna** — jeden plik `data/dev.db`; kopia zapasowa lokalnie = skopiowanie tego pliku.
- **Sesje kont Vinted** (od Etapu 8) — w bazie wyłącznie w postaci zaszyfrowanej (AES-256-GCM); klucz szyfrujący tylko w zmiennej środowiskowej.

## Struktura projektu

```
src/
├── app/          # ekrany aplikacji i API (Next.js App Router)
├── components/   # współdzielone komponenty interfejsu
├── db/           # schemat bazy (Drizzle) i klient
├── domain/       # czysta logika biznesowa — pokryta testami
├── adapters/     # integracje z platformami (od Etapu 4)
├── ai/           # generowanie ogłoszeń (od Etapu 3)
├── storage/      # przechowywanie zdjęć (od Etapu 2)
└── lib/          # konfiguracja, sesja logowania
drizzle/          # migracje SQL (generowane z schematu)
docs/             # dokumentacja architektury
```

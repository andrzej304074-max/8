# Menedżer Sprzedaży Vinted

Aplikacja webowa do zarządzania sprzedażą odzieży używanej: magazyn przedmiotów,
generowanie ogłoszeń przez AI, harmonogram publikacji i statystyki finansowe.
Projekt architektury: [`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md).

## Stan prac

- [x] **Etap 1 — Fundament**: szkielet aplikacji, schemat bazy z migracjami, logowanie hasłem, ekran Magazynu
- [x] **Etap 2 — Magazyn**: CRUD przedmiotów, zdjęcia z czyszczeniem EXIF (w tym GPS), filtry, siatka/tabela, masowa edycja, widok „zalegające"
- [x] **Etap 3 — Generowanie ogłoszeń przez AI**: Gemini (darmowy plan), walidacja Zod z ponowną próbą, cache po hashu zdjęć, formularz akceptacji
- [x] **Etap 4 — ManualAdapter i DryRunAdapter**: konta, paczka do ręcznego wklejenia, tryb dry run, dziennik EventLog w Historii
- [x] **Etap 5 — Scheduler i kolejka zadań**: harmonogram per konto, planer slotów, kalendarz z przeciąganiem, tick odporny na restarty, Dashboard „Do zrobienia dziś"
- [x] **Etap 6 — Silnik reguł relistingu**: reguły jako dane, edytor warunków/akcji, limity, podgląd na sucho
- [x] **Etap 7 — Statystyki i eksporty**: rejestrowanie sprzedaży z marżą, dashboard finansowy, „co się nie sprzedaje", eksporty CSV i kopia zapasowa
- [x] **Etap 8 — VintedAdapter**: pełna warstwa bezpieczeństwa (limiter, backoff, wyłącznik, idempotencja), realne wysyłanie jawnie wyłączone, sesje szyfrowane AES-256-GCM

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

## Harmonogram i kolejka publikacji

Zamiast wystawiać wszystko naraz, aplikacja rozkłada publikacje w czasie:

1. **Ustawienia** → dla każdego konta ustaw: ile przedmiotów dziennie, okno
   godzinowe (np. 8:00–21:00), dni tygodnia, losowy rozrzut oraz twarde limity
   operacji na godzinę i na dobę.
2. **Kolejka** → przycisk „Zaplanuj" rozkłada przedmioty w statusie „Gotowy" na
   konkretne terminy wg harmonogramu konta. Zadania widać na kalendarzu — możesz
   je **przeciągać** na inne dni, **wstrzymywać**, **wznawiać** i **anulować**.
3. **Dashboard** → gdy nadejdzie termin zadania, pojawia się na liście
   **„Do zrobienia dziś"**. Klikasz „Przygotuj paczkę" → tworzy się ogłoszenie
   i lądujesz na stronie paczki do wklejenia. **Człowiek w pętli** — nic nie
   publikuje się samo.

**Odporność na restarty:** nie ma procesu w tle. Zadania żyją w bazie, a
idempotentny „tick" uruchamia się przy każdym wejściu na Dashboard/Kolejkę
oraz raz dziennie przez Vercel Cron (`/api/cron/tick`, godz. 5:00 UTC). Po
przerwie świeżo zaległe zadania trafiają na listę „Do zrobienia", a starsze
(ponad 72 h) są przesuwane w najbliższe okno — bez lawiny zaległości.

Opcjonalnie ustaw `CRON_SECRET`, aby zabezpieczyć endpoint crona (Vercel dołączy
nagłówek automatycznie). Strefę czasową okien zmienisz zmienną `APP_TIMEZONE`
(domyślnie `Europe/Warsaw`).

## Reguły relistingu

Reguły to **dane w bazie, nie kod** — definiujesz je w zakładce **Reguły**:

- **Warunki** (wszystkie / dowolny): pola takie jak dni od wystawienia, dni w
  magazynie, liczba wyświetleń, polubień, cena, status — z operatorami
  (większe/mniejsze/równe…).
- **Akcja**: obniż cenę (o X%, nie poniżej progu, maks. N razy na przedmiot),
  wystaw ponownie albo odśwież ogłoszenie.
- **Limit wykonań** całej reguły (opcjonalny) i włącznik.

Przykłady ze specyfikacji, które da się złożyć klikając:
- „po 21 dniach obniż cenę o 10%, maksymalnie trzy razy, nie schodząc poniżej progu",
- „jeśli wystawiony dłużej niż 7 dni i mało wyświetleń — wystaw ponownie".

**Podgląd na sucho** (przycisk przy regule) pokazuje dokładnie, które przedmioty
reguła by dziś dotknęła i z jakim efektem („50,00 → 45,00 zł"), oraz osobno te
pasujące, ale pominięte (np. cena już na progu, wyczerpany limit obniżek). Nic
nie wykonuje się bez potwierdzenia. Obniżki cen zapisują się lokalnie i w
Historii — pamiętaj zaktualizować cenę także na platformie.

## Statystyki, finanse i eksporty

Gdy przedmiot się sprzeda, na stronie jego ogłoszenia klikasz **„Oznacz jako
sprzedane"** i podajesz cenę finalną, prowizję, koszt wysyłki i datę. Marża
liczy się automatycznie (cena finalna − prowizja − wysyłka − cena zakupu).

Zakładka **Statystyki** pokazuje: liczbę sprzedaży, przychód, łączną marżę,
średni czas od wystawienia do sprzedaży, rotację magazynu, najlepsze i najgorsze
kategorie oraz marki, widok **„co się nie sprzedaje"** z rozbiciem po przedziale
cenowym i wieku, a także **podsumowanie miesięczne** do rozliczeń.

**Eksporty** (przyciski w Statystykach):
- sprzedaż → CSV,
- cały magazyn → CSV,
- podsumowanie miesięczne → CSV,
- **kopia zapasowa całej bazy → jeden plik JSON** (w chmurze nie da się skopiować
  pliku bazy, więc backup to ten eksport; sekrety są w nim tylko zaszyfrowane).

Pliki CSV otwierają się poprawnie w Excelu z polskimi znakami (BOM + średnik).

## Automatyczne wystawianie na Vinted (lokalnie, przez przeglądarkę)

> ⚠️ **Automatyzacja Vinted łamie regulamin platformy i grozi ograniczeniem lub
> blokadą konta.** Ta funkcja istnieje na wyraźne życzenie i świadomą decyzję
> właściciela projektu. Domyślnym, bezpiecznym trybem pozostaje publikacja ręczna.

Ponieważ Vinted nie ma publicznego API, publikacja nie idzie przez ukryte
endpointy, tylko przez **wypełnienie tego samego formularza, który wypełniłby
człowiek** — w prawdziwej przeglądarce, w której logujesz się własnymi danymi.

### Przygotowanie (raz)

```
npx playwright install chromium
```

Masz już Chrome i nie chcesz pobierać drugiej przeglądarki? Wskaż swoją:
`CHROMIUM_PATH=/ścieżka/do/chrome` przed poleceniem.

### Użycie

1. W aplikacji ustaw konto na tryb **„Vinted automatyczny (przez przeglądarkę, lokalnie)"**.
2. Na karcie przedmiotu kliknij **Przygotuj ogłoszenie** — powstanie szkic.
3. W terminalu, w folderze projektu:

```
npm run publikuj
```

Otworzy się przeglądarka. Logujesz się na Vinted **raz** — sesja zostaje
zapamiętana w `data/vinted-profile/` (folder jest wykluczony z repozytorium).
Dalej skrypt dla każdego ogłoszenia wgrywa zdjęcia oraz wypełnia tytuł, opis i cenę.

### Tryby

| Polecenie | Zachowanie |
|---|---|
| `npm run publikuj` | **Domyślny, zalecany.** Wypełnia formularz i czeka — Ty sprawdzasz i klikasz „Wystaw" |
| `npm run publikuj -- --auto` | Skrypt sam klika „Wystaw" |
| `npm run publikuj -- --listing 12` | Tylko jedno wskazane ogłoszenie |

**Kategorii, marki, rozmiaru i stanu skrypt celowo nie wypełnia** — to na Vinted
rozwijane listy z wyszukiwarką, a źle dobrana kategoria to martwe ogłoszenie.
Skrypt wypisuje te wartości na ekranie, żebyś wyklikał je w sekundę.

Tempo jest ograniczone do ~1 wystawienia na 30 sekund. Każda operacja trafia do
**Historii** w aplikacji.

### Gdy Vinted zmieni wygląd strony

Skrypt zgłosi, którego pola nie znalazł, i pominie je (uzupełnisz ręcznie —
nic się nie psuje). Adresy pól poprawisz w pliku **`vinted-selectors.json`**,
w którym jest instrukcja krok po kroku, jak je znaleźć. Kodu nie trzeba dotykać.

## Wersja chmurowa — worker na Render

> ⚠️ **Uruchamianie z adresu IP centrum danych znacznie zwiększa ryzyko blokady
> konta** — dla systemów antyfraudowych logowanie na prywatne konto z serwerowni
> to silny sygnał. Wersja lokalna jest pod tym względem bezpieczniejsza.

Vercel nie uruchomi przeglądarki (limit funkcji ~50 MB przy Chromium ważącym
ponad 280 MB), więc publikacja dostaje **osobny worker w chmurze**. Aplikacja
zostaje na Vercelu; worker sięga do tej samej bazy Turso.

### Jak działa logowanie bez ekranu

W kontenerze nie ma jak kliknąć „zaloguj". Dlatego:

1. Logujesz się **raz u siebie**: `npm run zapisz-sesje`
2. Ciasteczka sesji trafiają do bazy **zaszyfrowane** (AES-256-GCM, klucz
   wyprowadzany z `SESSION_SECRET`, który żyje tylko w zmiennych środowiskowych).
3. Worker w chmurze odczytuje je i wstrzykuje do przeglądarki.

Gdy sesja wygaśnie, worker **zatrzymuje kolejkę tego konta**, oznacza sesję jako
wygasłą i zapisuje to w Historii — zamiast tłuc w platformę nieudanymi próbami.
Wtedy powtarzasz `npm run zapisz-sesje`.

### Wdrożenie krok po kroku

1. **Zapisz sesję u siebie** (bez tego worker nic nie zrobi):
   ```
   npm run zapisz-sesje
   ```
2. Wejdź na **https://render.com** → zaloguj się przez GitHub.
3. **New → Blueprint** → wskaż to repozytorium. Render wykryje plik `render.yaml`.
4. Uzupełnij zmienne środowiskowe (te same wartości co na Vercelu):

   | Zmienna | Skąd wziąć |
   |---|---|
   | `DATABASE_URL` | Turso |
   | `DATABASE_AUTH_TOKEN` | Turso |
   | `SESSION_SECRET` | **musi być identyczny jak na Vercelu** — inaczej sesja się nie odszyfruje |
   | `APP_PASSWORD` | to samo co na Vercelu |
   | `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob (worker pobiera stamtąd zdjęcia) |

5. Kliknij **Apply**. Worker zbuduje się z `Dockerfile` i będzie uruchamiany
   codziennie o 9:00 UTC (porę zmienisz w `render.yaml`, pole `schedule`).

### Co robi worker przy każdym uruchomieniu

Bierze szkice ogłoszeń z kont w trybie „Vinted automatyczny", wgrywa zdjęcia,
wypełnia tytuł, opis i cenę, wysyła formularz, aktualizuje statusy i zapisuje
wszystko do Historii. Tempo: ~1 wystawienie na 30 sekund.

### Wiele kont

Obsługa wielu kont jest wbudowana — masz ich pięć i wszystkie zadziałają.

**Sesję zapisujesz osobno dla każdego konta:**
```
npm run zapisz-sesje -- --account 1
npm run zapisz-sesje -- --account 2
```
(bez `--account` skrypt pokaże listę kont do wyboru)

Jak to działa pod spodem:

- **Każde konto ma własną, zaszyfrowaną sesję** w bazie — osobny rekord,
  osobny szyfrogram. Konta nie widzą nawzajem swoich danych logowania.
- **Worker przechodzi konta po kolei**, każde w **osobnej przeglądarce**.
  Dzięki temu ogłoszenie z konta B nigdy nie trafi na konto A.
- **Padnięta sesja jednego konta nie blokuje pozostałych** — worker wstrzymuje
  kolejkę tylko tego konta, zapisuje to w Historii i przechodzi do następnego.
- **Lokalnie każde konto ma własny profil przeglądarki** (`data/vinted-profile/<id>`),
  więc możesz być zalogowany na kilka kont naraz bez wylogowywania się nawzajem.
- **Limit tempa jest wspólny dla wszystkich kont** — świadomie. Chroni przed
  zalaniem platformy żądaniami niezależnie od tego, przez ile kont przechodzisz.

### Ograniczenie, o którym trzeba wiedzieć

Kategoria, marka, rozmiar i stan to na Vinted rozwijane listy z wyszukiwarką.
W trybie lokalnym wyklikujesz je sam. **W chmurze nie ma kto tego zrobić** —
jeśli Vinted wymaga tych pól, wysyłka formularza może się nie powieść i worker
zapisze błąd w Historii. Obsługę tych list trzeba dopracować na żywym formularzu
(selektory w `vinted-selectors.json`). Dlatego warto zacząć lokalnie.

## Integracja Vinted (warstwa bezpieczeństwa adaptera)

> **Automatyczna publikacja jest celowo wyłączona.** Konta prywatne + regulamin
> Vinted (zakaz automatyzacji) oznaczają realne ryzyko ograniczenia lub blokady
> konta. Aplikacja jest w pełni użyteczna bez tej funkcji — tryb ręczny
> (paczka do wklejenia) jest domyślny.

`VintedAdapter` (w `src/adapters/vinted/`) jest zbudowany i przetestowany z pełną
warstwą bezpieczeństwa wymaganą przez architekturę:

- **Token bucket** — limiter wychodzących żądań, konserwatywny domyślnie.
- **Wykładniczy backoff z jitterem** przy błędach 429/5xx, ze stałą liczbą prób.
- **Wyłącznik bezpieczeństwa** — po N kolejnych błędach zatrzymuje adapter
  całkowicie i wymaga jawnego resetu (bez „przepychania się" dalej).
- **Idempotencja** — ponowienie po awarii nie tworzy duplikatu ogłoszenia.
- **Pełny zapis do EventLog** przed i po każdej operacji.
- **Wykrywanie wygasłej sesji** — zatrzymuje kolejkę konta i prosi o odnowienie,
  zamiast generować kaskadę błędów.

Kluczowe: **transport nic nie wysyła.** Cała maszyneria działa „na sucho"
(`DisabledVintedTransport`) — żaden pakiet nie opuszcza serwera. Realny transport
podłącza się wyłącznie dla oficjalnej ścieżki **Vinted Pro Integrations**,
podmieniając tę jedną klasę.

**Sesje kont** przechowywane są po stronie serwera **wyłącznie zaszyfrowane**
(AES-256-GCM; klucz wyprowadzany z `SESSION_SECRET`, który żyje tylko w zmiennej
środowiskowej) — zrzut bazy bez tego klucza nie ujawnia sesji.

Zakładka **Ustawienia → Integracja Vinted** pozwala zapisać sesję (zaszyfrowaną),
uruchomić **diagnostykę na sucho** (pokazuje, że adapter działa, a transport jest
wyłączony) i przetestować przepływ „sesja wygasła" (wstrzymuje kolejkę konta).

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

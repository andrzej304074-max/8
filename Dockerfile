# Worker publikujący na Vinted — uruchamiany w chmurze (np. Render).
#
# Obraz Microsoftu zawiera już Chromium wraz ze wszystkimi bibliotekami systemowymi,
# więc nie trzeba niczego doinstalowywać. Wersja MUSI odpowiadać wersji pakietu
# "playwright" w package.json — inaczej Playwright nie znajdzie przeglądarki.
FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

# Najpierw same zależności — dzięki temu kolejne wdrożenia budują się szybciej.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Worker nie ma ekranu i nie ma kto kliknąć „Wystaw" — tryb w pełni automatyczny.
ENV WORKER_MODE=1
ENV NODE_ENV=production

CMD ["npm", "run", "worker"]

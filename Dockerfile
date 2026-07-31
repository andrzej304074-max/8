# Zdalna przeglądarka Vinted + worker publikujący — wszystko w chmurze.
#
# Obraz Microsoftu zawiera już Chromium i biblioteki systemowe. Wersja MUSI
# odpowiadać wersji pakietu "playwright" w package.json — inaczej Playwright
# nie znajdzie przeglądarki.
FROM mcr.microsoft.com/playwright:v1.62.0-noble

# Xvfb   — wirtualny ekran (serwer nie ma monitora)
# x11vnc — udostępnia ten ekran
# novnc + websockify — pokazują go w zwykłej przeglądarce
# x11-utils — xdpyinfo, którym czekamy aż ekran wstanie
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb x11vnc novnc websockify x11-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Najpierw same zależności — kolejne wdrożenia budują się wtedy szybciej.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x docker/start.sh

# Worker nie ma kto obsłużyć ręcznie — działa w pełni automatycznie.
ENV WORKER_MODE=1
ENV NODE_ENV=production
ENV DISPLAY=:99

# Render przekazuje port w zmiennej PORT.
EXPOSE 10000

CMD ["./docker/start.sh"]

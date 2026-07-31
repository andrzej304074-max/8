#!/usr/bin/env bash
# Uruchamia całą układankę zdalnej przeglądarki w jednym kontenerze.
# Kolejność ma znaczenie: najpierw ekran, potem to, co go udostępnia.
set -euo pipefail

DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"
SCREEN="${SCREEN_SIZE:-1280x900x24}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

echo "[start] wirtualny ekran ${DISPLAY} (${SCREEN})"
Xvfb "${DISPLAY}" -screen 0 "${SCREEN}" -nolisten tcp &
XVFB_PID=$!

# Czekamy, aż ekran faktycznie wstanie — bez tego przeglądarka nie ma gdzie rysować.
for _ in $(seq 1 30); do
  if xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

echo "[start] udostępnianie ekranu (x11vnc, tylko lokalnie)"
# -localhost: port VNC nie jest wystawiony na świat. Dostęp wyłącznie przez
# nasz panel, który wymaga hasła.
x11vnc -display "${DISPLAY}" -forever -shared -nopw -localhost -rfbport 5900 -quiet &
X11VNC_PID=$!

echo "[start] most WebSocket + noVNC na porcie ${NOVNC_PORT}"
websockify --web=/usr/share/novnc "${NOVNC_PORT}" localhost:5900 &
WEBSOCKIFY_PID=$!

# Sprzątanie po zatrzymaniu kontenera.
cleanup() {
  kill "${XVFB_PID}" "${X11VNC_PID}" "${WEBSOCKIFY_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[start] panel zdalnej przeglądarki"
exec npx tsx scripts/remote-server.ts

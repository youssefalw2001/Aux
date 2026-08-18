#!/usr/bin/env bash
# Bounded verification: boots the app, exercises the routes, then shuts down.
set -u
cd /projects/sandbox/aux

setsid pnpm run dev > /tmp/dev.log 2>&1 < /dev/null &
SRV=$!

cleanup() {
  kill -TERM -"$SRV" 2>/dev/null
  pkill -f "next-server" 2>/dev/null
  pkill -f "next dev" 2>/dev/null
}
trap cleanup EXIT

# Wait for readiness (max 45s)
for _ in $(seq 1 45); do
  sleep 1
  curl -sf -o /dev/null http://localhost:3000/ 2>/dev/null && break
done

echo "=== HOME ==="
curl -s -o /tmp/home.html -w "HTTP %{http_code}\n" http://localhost:3000/
grep -o "Play a round" /tmp/home.html | head -1

echo "=== DEMO ==="
curl -s -o /tmp/demo.html -w "HTTP %{http_code}\n" http://localhost:3000/demo
grep -o "voice note party game" /tmp/demo.html | head -1

echo "=== ROOM PAGE /r/PARTY ==="
curl -s -o /tmp/room.html -w "HTTP %{http_code}\n" http://localhost:3000/r/PARTY
grep -o "Room PARTY" /tmp/room.html | head -1
grep -o "more to unlock the reveal" /tmp/room.html | head -1
grep -o 'property="og:image"[^"]*"[^"]*"' /tmp/room.html | head -1

echo "=== OG UNFURL CARD ==="
mkdir -p /projects/sandbox/aux/docs/preview
curl -s -o /projects/sandbox/aux/docs/preview/unfurl-card.png \
  -w "HTTP %{http_code} | %{content_type} | %{size_download} bytes\n" \
  http://localhost:3000/r/PARTY/opengraph-image
file /projects/sandbox/aux/docs/preview/unfurl-card.png

echo "=== SERVER LOG (tail) ==="
tail -12 /tmp/dev.log

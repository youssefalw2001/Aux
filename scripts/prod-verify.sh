#!/usr/bin/env bash
# Verifies the SERVER build: arbitrary room codes must render on demand,
# not just the two codes listed in generateStaticParams.
set -u
cd "$(dirname "$0")/.."

setsid pnpm exec next start > /tmp/prod.log 2>&1 < /dev/null &
SRV=$!
cleanup() { kill -TERM -"$SRV" 2>/dev/null; pkill -f "next-server" 2>/dev/null; }
trap cleanup EXIT

for _ in $(seq 1 40); do
  sleep 1
  curl -sf -o /dev/null http://localhost:3000/ 2>/dev/null && break
done

fail=0
chk() {
  code=$(curl -s -o /tmp/b -w "%{http_code}" "$2")
  ok=1; [ "$code" = "$3" ] || ok=0
  if [ -n "${4:-}" ] && ! grep -q "$4" /tmp/b; then ok=0; fi
  if [ "$ok" = 1 ]; then echo "  ✓ $1 ($code)"; else echo "  ✗ $1 (got $code)"; fail=$((fail+1)); fi
}

echo "── prebuilt codes"
chk "room PARTY"            http://localhost:3000/r/PARTY            200 "unlock"
echo "── ARBITRARY code (must work — this is the real product path)"
chk "room ZQ7X4"            http://localhost:3000/r/ZQ7X4            200 "unlock"
chk "room ZQ7X4 og image"   http://localhost:3000/r/ZQ7X4/opengraph-image 200
echo "── other routes"
chk "landing"               http://localhost:3000/                   200 "Tap to record"
# No trailing slash here: trailingSlash is only enabled for the Pages export,
# so the server target correctly 308s /demo/ → /demo.
chk "demo"                  http://localhost:3000/demo               200 "voice note party game"

ct=$(curl -s -o /dev/null -w "%{content_type}" http://localhost:3000/r/ZQ7X4/opengraph-image)
echo "  og content-type: $ct"
[ "$ct" = "image/png" ] || { echo "  ✗ og image not image/png"; fail=$((fail+1)); }

echo ""
[ "$fail" = 0 ] && echo "SERVER BUILD OK" || echo "SERVER BUILD: $fail failure(s)"
exit "$fail"

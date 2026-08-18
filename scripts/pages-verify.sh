#!/usr/bin/env bash
# Builds the static export and serves it exactly as GitHub Pages would
# (under the basePath), then checks the real routes.
set -u
cd "$(dirname "$0")/.."

BASE="${PAGES_BASE_PATH:-/Aux}"

rm -rf out .next
PAGES_BUILD=1 PAGES_BASE_PATH="$BASE" pnpm exec next build > /tmp/pages-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "export build failed:"; tail -25 /tmp/pages-build.log; exit 1
fi
node scripts/postexport.mjs

# Mirror the basePath so relative asset URLs resolve like they will on Pages
SERVE_ROOT=$(mktemp -d)
mkdir -p "$SERVE_ROOT${BASE}"
cp -r out/. "$SERVE_ROOT${BASE}/"

setsid python3 -m http.server 8090 --directory "$SERVE_ROOT" > /tmp/pages-serve.log 2>&1 < /dev/null &
SRV=$!
cleanup() { kill -TERM -"$SRV" 2>/dev/null; rm -rf "$SERVE_ROOT"; }
trap cleanup EXIT

for _ in $(seq 1 20); do
  sleep 0.5
  curl -sf -o /dev/null "http://localhost:8090${BASE}/" 2>/dev/null && break
done

fail=0
chk() { # label url expected_code [grep_pattern]
  code=$(curl -s -o /tmp/body -w "%{http_code}" "$2")
  ok=1
  [ "$code" = "$3" ] || ok=0
  if [ -n "${4:-}" ] && ! grep -q "$4" /tmp/body; then ok=0; fi
  if [ "$ok" = "1" ]; then echo "  ✓ $1 ($code)"; else echo "  ✗ $1 (got $code)"; fail=$((fail+1)); fi
}

echo "── serving from ${BASE}"
chk "landing"        "http://localhost:8090${BASE}/"                        200 "aux"
# Regression guard: the root MUST link into the game, with basePath applied.
# It previously rendered a bare record screen with no route forward at all.
# trailingSlash is on for this target, so hrefs carry a trailing slash
chk "landing → roulette link" "http://localhost:8090${BASE}/"              200 "href=\"${BASE}/demo/\?\""
chk "landing → bottle link"   "http://localhost:8090${BASE}/"              200 "href=\"${BASE}/demo/bottle/\?\""
chk "landing CTA copy"        "http://localhost:8090${BASE}/"              200 "Spin the Bottle"
chk "demo page"      "http://localhost:8090${BASE}/demo/"                   200 "voice note party game"
chk "bottle page"    "http://localhost:8090${BASE}/demo/bottle/"            200 "Join the circle"
chk "room DEMO"      "http://localhost:8090${BASE}/r/DEMO/"                 200 "Room"
chk "room PARTY"     "http://localhost:8090${BASE}/r/PARTY/"                200 "unlock"
chk "og png copy"    "http://localhost:8090${BASE}/r/PARTY/opengraph-image.png" 200
chk "css bundle"     "$(grep -o "${BASE}/_next/static/chunks/[a-z0-9_-]*\.css" out/index.html | head -1 | sed "s|^|http://localhost:8090|")" 200
chk ".nojekyll"      "http://localhost:8090${BASE}/.nojekyll"               200

echo ""
[ "$fail" = "0" ] && echo "PAGES EXPORT OK" || echo "PAGES EXPORT: $fail failure(s)"
exit "$fail"

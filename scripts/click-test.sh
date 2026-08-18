#!/usr/bin/env bash
# Serves the static export under /Aux and click-tests the landing buttons.
set -u
cd "$(dirname "$0")/.."

BASE="${PAGES_BASE_PATH:-/Aux}"
rm -rf out .next
PAGES_BUILD=1 PAGES_BASE_PATH="$BASE" pnpm exec next build > /tmp/ct-build.log 2>&1
if [ $? -ne 0 ]; then echo "build failed:"; tail -20 /tmp/ct-build.log; exit 1; fi
node scripts/postexport.mjs > /dev/null

ROOT=$(mktemp -d)
mkdir -p "$ROOT${BASE}"
cp -r out/. "$ROOT${BASE}/"
setsid python3 -m http.server 8090 --directory "$ROOT" > /tmp/ct-serve.log 2>&1 < /dev/null &
SRV=$!
cleanup() { kill -TERM -"$SRV" 2>/dev/null; rm -rf "$ROOT"; }
trap cleanup EXIT

for _ in $(seq 1 20); do
  sleep 0.5
  curl -sf -o /dev/null "http://localhost:8090${BASE}/" 2>/dev/null && break
done

PLAYWRIGHT_BROWSERS_PATH=/opt/playwright node scripts/click-test.mjs

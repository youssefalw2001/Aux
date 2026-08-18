#!/usr/bin/env bash
# Boots the app and runs the browser console/hydration check.
set -u
cd "$(dirname "$0")/.."

setsid pnpm run dev > /tmp/bc-dev.log 2>&1 < /dev/null &
SRV=$!
cleanup() { kill -TERM -"$SRV" 2>/dev/null; pkill -f "next dev" 2>/dev/null; }
trap cleanup EXIT

for _ in $(seq 1 45); do
  sleep 1
  curl -sf -o /dev/null http://localhost:3000/ 2>/dev/null && break
done

PLAYWRIGHT_BROWSERS_PATH=/opt/playwright node scripts/browser-check.mjs
RESULT=$?
[ "$RESULT" -ne 0 ] && { echo "--- dev log ---"; tail -15 /tmp/bc-dev.log; }
exit "$RESULT"

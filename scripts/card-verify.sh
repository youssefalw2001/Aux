#!/usr/bin/env bash
# Boots the app and screenshots the share-card harness.
set -u
cd "$(dirname "$0")/.."

setsid pnpm run dev > /tmp/card-dev.log 2>&1 < /dev/null &
SRV=$!
cleanup() { kill -TERM -"$SRV" 2>/dev/null; pkill -f "next dev" 2>/dev/null; }
trap cleanup EXIT

for _ in $(seq 1 45); do
  sleep 1
  curl -sf -o /dev/null http://localhost:3000/dev/card 2>/dev/null && break
done

node scripts/card-shots.mjs
RESULT=$?
[ "$RESULT" -ne 0 ] && { echo "--- dev log ---"; tail -20 /tmp/card-dev.log; }
exit "$RESULT"

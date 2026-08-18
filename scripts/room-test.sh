#!/usr/bin/env bash
# Boots the room worker locally and runs the end-to-end round test.
set -u
cd "$(dirname "$0")/.."

setsid npx wrangler dev --port 8787 --local > /tmp/wrangler.log 2>&1 < /dev/null &
SRV=$!

cleanup() {
  kill -TERM -"$SRV" 2>/dev/null
  pkill -f "wrangler dev" 2>/dev/null
  pkill -f workerd 2>/dev/null
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  sleep 1
  curl -sf -o /dev/null http://localhost:8787/health 2>/dev/null && break
done

if ! curl -sf http://localhost:8787/health > /dev/null 2>&1; then
  echo "worker failed to boot:"
  tail -30 /tmp/wrangler.log
  exit 1
fi

echo "health: $(curl -s http://localhost:8787/health)"
node scripts/room-e2e.mjs
RESULT=$?

if [ "$RESULT" -ne 0 ]; then
  echo "--- wrangler log ---"
  tail -30 /tmp/wrangler.log
fi
exit "$RESULT"

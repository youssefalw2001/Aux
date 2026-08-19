/**
 * Audits the daily prompt rotation against the real implementation.
 *
 * Verifies the properties the mechanic actually promises:
 *  1. It changes every single day (no back-to-back repeats).
 *  2. Every prompt is used once before any repeats.
 *  3. Two users anywhere on Earth see the same prompt at the same instant.
 *  4. The order isn't guessable from the day number.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Load the TS sources directly via Node's type stripping (Node 22+).
process.env.NODE_OPTIONS = "";
const { dailyPrompt, dailyNumber } = await import("../src/lib/daily.ts");
const { DAILY_ELIGIBLE } = await import("../src/lib/prompts.ts");
void register;
void pathToFileURL;

const DAY = 86_400_000;
const size = DAILY_ELIGIBLE.length;
const days = size * 3 + 10;
const start = Date.UTC(2026, 7, 18);

const seq = [];
for (let d = 0; d < days; d++) {
  seq.push(dailyPrompt(new Date(start + d * DAY)).id);
}

let fails = 0;
const ok = (label, cond, extra = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`);
  if (!cond) fails++;
};

console.log(`eligible deck: ${size} prompts · simulating ${days} days\n`);
console.log(`  first 8 days: ${seq.slice(0, 8).join(", ")}\n`);

// 1. no back-to-back repeats
let btb = 0;
for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) btb++;
ok("changes every day", btb === 0, `${btb} back-to-back repeats`);

// 2. full coverage within a season.
// Must be aligned to a season boundary — sampling an arbitrary 33-day window
// spans two seasons and legitimately contains duplicates. (This assertion was
// wrong before and reported a bug that didn't exist.)
const EPOCH_DAY = Date.UTC(2026, 7, 1);
const seasonStart = EPOCH_DAY + size * 2 * DAY; // start of season 2
const oneSeason = [];
for (let d = 0; d < size; d++) {
  oneSeason.push(dailyPrompt(new Date(seasonStart + d * DAY)).id);
}
ok(
  "every prompt used exactly once per season",
  new Set(oneSeason).size === size,
  `${new Set(oneSeason).size}/${size} distinct across one aligned season`,
);

// 2b. no repeat across a season boundary either
const boundary = [];
for (let d = -2; d < 3; d++) {
  boundary.push(dailyPrompt(new Date(seasonStart + d * DAY)).id);
}
let boundaryRepeat = false;
for (let i = 1; i < boundary.length; i++) {
  if (boundary[i] === boundary[i - 1]) boundaryRepeat = true;
}
ok("no repeat across a season boundary", !boundaryRepeat, boundary.join(" → "));

// 3. same instant → same prompt regardless of the observer's timezone.
// dailyPrompt reads UTC components, so a fixed instant must be invariant.
const instant = new Date(Date.UTC(2026, 8, 3, 23, 30));
const asSeenBy = ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Auckland"].map(
  (tz) => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    const r = dailyPrompt(instant).id;
    process.env.TZ = prev;
    return r;
  },
);
ok(
  "identical worldwide at the same instant",
  new Set(asSeenBy).size === 1,
  asSeenBy.join(" / "),
);

// 4. not a simple walk through the deck
const ids = DAILY_ELIGIBLE.map((p) => p.id);
const idx = seq.map((id) => ids.indexOf(id));
const sequential = idx.slice(1).every((v, i) => v === (idx[i] + 1) % size);
ok("order is not sequential/guessable", !sequential);

// 5. day number advances
const n1 = dailyNumber(new Date(start));
const n2 = dailyNumber(new Date(start + DAY));
ok("daily number increments", n2 === n1 + 1, `#${n1} → #${n2}`);

console.log("");
console.log(fails === 0 ? "DAILY ROTATION OK" : `DAILY ROTATION: ${fails} problem(s)`);
process.exit(fails === 0 ? 0 : 1);

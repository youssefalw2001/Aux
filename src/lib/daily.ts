import { DAILY_ELIGIBLE, type Prompt } from "./prompts";

/**
 * One global prompt per day, the same for everyone, everywhere.
 *
 * This is the structural virality mechanic, and it's worth being precise about
 * why: Wordle's innovation was never the word game — it was that everyone
 * played the SAME puzzle on the SAME day. That single constraint produces:
 *
 *   · a shared conversation ("did you see today's?") instead of thousands of
 *     disconnected private sessions
 *   · a daily reason to open the app and to post
 *   · a meaningful global leaderboard — "top takes today" is watchable content
 *     for people who never played, which is the only way the algorithm ever
 *     picks you up
 *   · scarcity: one shot a day makes each attempt matter
 *
 * A room-only game has none of that. Every session is invisible to everyone
 * outside the room.
 */

/** Launch epoch. Daily #1 is this date. */
const EPOCH = Date.UTC(2026, 7, 1); // 2026-08-01
const DAY_MS = 86_400_000;

/** UTC-normalised day index so the prompt flips at the same instant globally. */
function dayIndex(now: Date = new Date()): number {
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.floor((utcMidnight - EPOCH) / DAY_MS);
}

export function dailyNumber(now?: Date): number {
  return Math.max(1, dayIndex(now) + 1);
}

/**
 * Deterministic prompt for the day.
 *
 * Uses a hash of the day index rather than `index % length` so consecutive
 * days don't walk the deck in a predictable order — otherwise players learn
 * tomorrow's prompt, which kills the surprise the whole format depends on.
 */
/** Deterministic 32-bit PRNG. Same seed → same sequence, on every device. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deck order for a "season" — one full pass through every eligible prompt.
 *
 * Originally this hashed the day index independently per day, which meant the
 * same prompt could come up two days running (measured: 3 back-to-back repeats
 * and a 1-day minimum gap across 120 days). For a mechanic whose entire promise
 * is "one prompt a day, everyone, worldwide", repeating yesterday's is a
 * credibility bug — it makes the whole thing look broken.
 *
 * A seeded shuffle per season guarantees every prompt appears exactly once
 * before any repeats, while staying unpredictable from the day number alone.
 */
function shuffleFor(season: number, size: number): number[] {
  const rand = mulberry32(season * 0x9e3779b1 + 17);
  const order = Array.from({ length: size }, (_, i) => i);
  // Fisher-Yates
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function seasonOrder(season: number, size: number): number[] {
  const order = shuffleFor(season, size);
  if (size < 2) return order;

  /**
   * Season boundaries are the one place a repeat can still sneak through: the
   * last prompt of one season and the first of the next are drawn from
   * independent shuffles, so they can collide and produce the same prompt two
   * days running — the exact failure the shuffle was meant to remove.
   * Rotating the new season by one when that happens costs nothing and makes
   * "never the same prompt twice in a row" an actual guarantee rather than a
   * probabilistic one.
   */
  const prevLast = shuffleFor(season - 1, size)[size - 1];
  if (order[0] === prevLast) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

export function dailyPrompt(now?: Date): Prompt {
  const size = DAILY_ELIGIBLE.length;
  const i = dayIndex(now);
  // Floor toward negative infinity so pre-epoch dates don't invert the season.
  const season = Math.floor(i / size);
  const slot = ((i % size) + size) % size;
  // Standalone-only: the daily clip is the one strangers see in the global
  // feed, so it has to be funny with no knowledge of the prompt.
  return DAILY_ELIGIBLE[seasonOrder(season, size)[slot]];
}

/** Milliseconds until the next global prompt drops. Drives a countdown. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return nextUtcMidnight - now.getTime();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

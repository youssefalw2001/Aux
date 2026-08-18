import { FREE_DECK, type Prompt } from "./prompts";

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
export function dailyPrompt(now?: Date): Prompt {
  const i = dayIndex(now);
  let h = (i + 1) * 2654435761;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return FREE_DECK[Math.abs(h) % FREE_DECK.length];
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

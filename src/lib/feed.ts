import { dailyNumber, dailyPrompt } from "./daily";

/**
 * The global feed — "top takes today".
 *
 * This is the piece that turns a party game into something with an algorithmic
 * surface. Without it, the daily prompt is just a prompt: every session stays
 * invisible to everyone outside the room, and there is nothing for a stranger to
 * land on. With it, the best clip of the day is watchable content for people who
 * never played, which is the only path to being picked up at all.
 *
 * Currently deterministic mock data so the surface is fully designed and
 * navigable. Real implementation reads from Postgres with a hot-ranking query
 * (votes decayed by age), fronted by a cache — see notes in getFeed.
 */

export type FeedRange = "today" | "week" | "all";

export interface FeedClip {
  id: string;
  authorName: string;
  /** Deterministic hue so avatars are distinguishable without images. */
  hue: number;
  caption: string;
  prompt: string;
  peaks: number[];
  durationMs: number;
  votes: number;
  plays: number;
  /** Minutes ago. */
  age: number;
  isDaily: boolean;
}

const CAPTIONS: Array<[string, string, string]> = [
  ["Nia", "he really said that with his whole chest", "Leave a voicemail breaking up with someone over something extremely petty."],
  ["Marcus", "the confidence is what kills me", "Say “I'm not drunk” like you are extremely drunk."],
  ["Yasmin", "she apologised for something she did NOT do", "Record the most convincing fake apology you can manage."],
  ["Dae", "bro forgot he was being recorded", "Confess to a crime you did not commit, with too much detail."],
  ["Priya", "not the customer service voice", "Do a customer service voice while delivering genuinely upsetting news."],
  ["Tobi", "this is going in the group chat forever", "Do your best impression of someone in this group chat."],
  ["Elif", "the pause before she says it", "Tell them something you've never said out loud."],
  ["Kwame", "he committed to the bit and lost", "Sell me something in your room like it's a late-night infomercial."],
  ["Hana", "she started crying laughing halfway", "Describe them as a song. Sing a bit of it."],
  ["Otto", "the weather forecast for his mental state", "Give a weather forecast for your current emotional state."],
  ["Sana", "10 seconds of pure chaos", "Hype them up like you're introducing them at a fight."],
  ["Leo", "he really went for the throat", "Say something nice in the most threatening tone possible."],
];

/** Stable pseudo-random from a string, so the feed doesn't reshuffle on reload. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function peaksFor(seed: string, n = 44): number[] {
  let h = hash(seed);
  return Array.from({ length: n }, (_, i) => {
    h = (h ^ (h << 13)) >>> 0;
    h = (h ^ (h >>> 17)) >>> 0;
    const noise = ((h % 1000) / 1000) * 0.72 + 0.28;
    const envelope = Math.sin((i / n) * Math.PI) * 0.6 + 0.4;
    return Math.max(0.1, Math.min(1, noise * envelope));
  });
}

export function getFeed(range: FeedRange): FeedClip[] {
  const todaysPrompt = dailyPrompt().text;
  const salt = `${range}-${dailyNumber()}`;

  /**
   * Real query shape:
   *
   *   SELECT ... FROM clips
   *   WHERE created_at > now() - $window
   *   ORDER BY votes / pow(hours_since_created + 2, 1.5) DESC
   *
   * Hot-ranking rather than raw vote count, otherwise the feed calcifies within
   * a week and new clips can never surface — which kills the reason to post.
   */
  return CAPTIONS.map(([authorName, caption, prompt], i) => {
    const seed = `${salt}-${authorName}-${i}`;
    const h = hash(seed);
    const isDaily = i % 3 === 0;
    const multiplier = range === "today" ? 1 : range === "week" ? 6 : 34;

    return {
      id: seed,
      authorName,
      hue: h % 360,
      caption,
      prompt: isDaily ? todaysPrompt : prompt,
      peaks: peaksFor(seed),
      durationMs: 4200 + (h % 14) * 1400,
      votes: Math.round((6 + (h % 40)) * multiplier),
      plays: Math.round((80 + (h % 900)) * multiplier),
      age: range === "today" ? 6 + (h % 700) : 200 + (h % 9000),
      isDaily,
    };
  }).sort((a, b) => b.votes - a.votes);
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

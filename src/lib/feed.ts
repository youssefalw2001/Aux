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

/**
 * Captions are written the way a real one would be: reacting to the AUDIO, not
 * restating the prompt. That's the whole point of the format — someone scrolling
 * reads the caption, hears three seconds, and gets it.
 */
const CAPTIONS: Array<[string, string, string]> = [
  ["Nia", "the accent did not survive the third sentence", "Order a drive-thru meal in the poshest British accent you own."],
  ["Marcus", "he really committed to being a GPS having a breakdown", "Be a GPS that has completely given up on you."],
  ["Yasmin", "she said “we are going down” like a weather update", "Airline safety announcement, except the plane is definitely going down."],
  ["Dae", "bro narrated a radiator like it was a lion", "Nature documentary narration of whatever is nearest to you."],
  ["Priya", "the meditation app is threatening me now", "Be a meditation app that is slowly losing its patience with you."],
  ["Tobi", "auctioneering a broken chair for 40 seconds straight", "Auctioneer. Sell the ugliest thing you can currently see."],
  ["Elif", "“I'm fine” number five was genuinely upsetting", "Say “I'm fine” five times. Each one less convincing."],
  ["Kwame", "he made laundry sound like a war crime", "Villain monologue, but your evil plan is about laundry."],
  ["Hana", "she got through it in ONE breath somehow", "Explain your job in one breath. Go."],
  ["Otto", "the true crime intro about a stolen yoghurt", "True crime podcast intro, but the crime is extremely petty."],
  ["Sana", "movie trailer voice for brushing his teeth", "Movie trailer voice. Describe your morning."],
  ["Leo", "the “no worries” escalation is unmatched", "Say “no worries” three ways: polite, passive aggressive, then unhinged."],
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

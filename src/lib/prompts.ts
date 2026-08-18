/**
 * Prompt decks.
 *
 * THE DESIGN RULE THAT MATTERS: a prompt must produce a clip that is funny to
 * someone who never saw the prompt.
 *
 * This is the test everything here has to pass, and it's the thing the first
 * version of these decks failed. "Say something nice about Maya" produces a
 * clip that means nothing without context — and context is exactly what gets
 * lost the moment a clip leaves the room. A clip travels alone. If the joke
 * lives in the prompt rather than in the audio, it dies on arrival.
 *
 * "Do a nature documentary narration of your fridge" produces thirty seconds
 * that are funny cold, to a stranger, with no setup. That clip can travel.
 *
 * Two formats do the heaviest lifting:
 *
 *   ACCENTS AND IMPRESSIONS are the most remixable thing in audio. They invite
 *   "I could do that better", which is the entire duet/stitch engine — the
 *   single strongest organic growth mechanic on short-form video. Nobody
 *   stitches a text poll.
 *
 *   CHARACTER VOICES (GPS, flight attendant, auctioneer, true-crime narrator)
 *   are instantly legible references. The listener gets the bit in two seconds,
 *   which is all the time a scroll gives you.
 *
 * Every prompt is also performable in under 30 seconds and needs no props.
 */

export type PromptFormat =
  | "accent"
  | "character"
  | "narration"
  | "escalation"
  | "constraint";

/** Shown as a badge on the prompt card and burned into the share card. */
export const FORMAT_LABEL: Record<PromptFormat, string> = {
  accent: "Accent challenge",
  character: "Character",
  narration: "Narration",
  escalation: "Escalation",
  constraint: "Hard mode",
};

export interface Prompt {
  id: string;
  text: string;
  /** Rough spice level, 1 (safe) – 3 (edgy). Used for deck filtering. */
  heat: 1 | 2 | 3;
  format: PromptFormat;
  /**
   * True when the clip is funny with zero knowledge of the prompt. Only
   * standalone prompts are eligible for the daily and the global feed, because
   * those clips are seen by strangers.
   */
  standalone: boolean;
}

export const FREE_DECK: Prompt[] = [
  /* ---------------- accents & impressions ---------------- */
  { id: "a1", text: "Order a drive-thru meal in the poshest British accent you own.", heat: 1, format: "accent", standalone: true },
  { id: "a2", text: "Explain why you're late in three different accents, each one more panicked.", heat: 1, format: "accent", standalone: true },
  { id: "a3", text: "Read the last text you sent like a Shakespearean villain.", heat: 2, format: "accent", standalone: true },
  { id: "a4", text: "Do a pirate accent, but you work in customer service and it's your last day.", heat: 1, format: "accent", standalone: true },
  { id: "a5", text: "Say “I have never been more disrespected” in the fanciest accent you can hold.", heat: 2, format: "accent", standalone: true },

  /* ---------------- character voices ---------------- */
  { id: "c1", text: "Be a GPS that has completely given up on you.", heat: 1, format: "character", standalone: true },
  { id: "c2", text: "Airline safety announcement, except the plane is definitely going down.", heat: 2, format: "character", standalone: true },
  { id: "c3", text: "Be a meditation app that is slowly losing its patience with you.", heat: 1, format: "character", standalone: true },
  { id: "c4", text: "Auctioneer. Sell the ugliest thing you can currently see.", heat: 1, format: "character", standalone: true },
  { id: "c5", text: "Be a flight attendant who is completely over it.", heat: 2, format: "character", standalone: true },
  { id: "c6", text: "Villain monologue, but your evil plan is about laundry.", heat: 1, format: "character", standalone: true },
  { id: "c7", text: "Hostage negotiator, but you're talking someone out of a bad haircut.", heat: 1, format: "character", standalone: true },
  { id: "c8", text: "Be a drive-thru speaker that's 90% static and 10% attitude.", heat: 1, format: "character", standalone: true },
  { id: "c9", text: "Leave a voicemail breaking up with someone over something extremely petty.", heat: 2, format: "character", standalone: true },
  { id: "c10", text: "Infomercial host selling something in your room at 3am.", heat: 1, format: "character", standalone: true },

  /* ---------------- narration ---------------- */
  { id: "n1", text: "Nature documentary narration of whatever is nearest to you.", heat: 1, format: "narration", standalone: true },
  { id: "n2", text: "Sports commentary on the most boring thing in your room.", heat: 1, format: "narration", standalone: true },
  { id: "n3", text: "True crime podcast intro, but the crime is extremely petty.", heat: 2, format: "narration", standalone: true },
  { id: "n4", text: "Movie trailer voice. Describe your morning.", heat: 1, format: "narration", standalone: true },
  { id: "n5", text: "Breaking news anchor covering what you had for lunch.", heat: 1, format: "narration", standalone: true },
  { id: "n6", text: "Narrate the group chat like a war documentary.", heat: 2, format: "narration", standalone: true },
  { id: "n7", text: "ASMR review of the nearest household object.", heat: 1, format: "narration", standalone: true },
  { id: "n8", text: "Do a perfume ad for the smell of your room.", heat: 2, format: "narration", standalone: true },

  /* ---------------- escalation ---------------- */
  { id: "e1", text: "Say “I'm fine” five times. Each one less convincing.", heat: 2, format: "escalation", standalone: true },
  { id: "e2", text: "Say “no worries” three ways: polite, passive aggressive, then unhinged.", heat: 2, format: "escalation", standalone: true },
  { id: "e3", text: "Laugh, and let it slowly become a cry for help.", heat: 2, format: "escalation", standalone: true },
  { id: "e4", text: "Say “interesting” like it means six different things.", heat: 1, format: "escalation", standalone: true },
  { id: "e5", text: "Apologise, but get progressively less sorry.", heat: 2, format: "escalation", standalone: true },

  /* ---------------- constraint ---------------- */
  { id: "k1", text: "Explain your job in one breath. Go.", heat: 1, format: "constraint", standalone: true },
  { id: "k2", text: "Describe your day without using the word “and”.", heat: 1, format: "constraint", standalone: true },
  { id: "k3", text: "Whisper the most dramatic sentence you can think of.", heat: 2, format: "constraint", standalone: true },
  { id: "k4", text: "Say something genuinely profound in the least profound voice possible.", heat: 1, format: "constraint", standalone: true },
  { id: "k5", text: "Tell a complete story in exactly ten words.", heat: 1, format: "constraint", standalone: true },
];

/**
 * Spin the Bottle deck.
 *
 * Directed at whoever the bottle landed on — by definition someone in the room
 * and playing. `{name}` is substituted at render time.
 *
 * These are intentionally NOT marked standalone: a clip about a specific person
 * only lands for people who know them, so they stay in-room and are excluded
 * from the daily and the global feed. The format still leans on impressions and
 * characters, because that's what makes them fun to perform rather than just
 * sweet.
 */
export const BOTTLE_DECK: Prompt[] = [
  { id: "b1", text: "Introduce {name} like a wrestling announcer.", heat: 1, format: "character", standalone: false },
  { id: "b2", text: "Nature documentary narration of {name}.", heat: 1, format: "narration", standalone: false },
  { id: "b3", text: "Be {name}'s hype man for ten seconds straight.", heat: 1, format: "character", standalone: false },
  { id: "b4", text: "Do your best impression of {name}.", heat: 2, format: "accent", standalone: false },
  { id: "b5", text: "Movie trailer voice: {name}, the origin story.", heat: 1, format: "narration", standalone: false },
  { id: "b6", text: "Say the nicest thing you can about {name} — in a completely threatening tone.", heat: 2, format: "escalation", standalone: false },
  { id: "b7", text: "What's the first thing you noticed about {name}?", heat: 2, format: "constraint", standalone: false },
  { id: "b8", text: "Describe {name} as a song. Sing a bit of it.", heat: 1, format: "constraint", standalone: false },
  { id: "b9", text: "True crime intro, and {name} is the prime suspect.", heat: 2, format: "narration", standalone: false },
  { id: "b10", text: "Tell {name} something you've never said out loud.", heat: 3, format: "constraint", standalone: false },
  { id: "b11", text: "What does {name} do that everyone notices but nobody mentions?", heat: 2, format: "constraint", standalone: false },
  { id: "b12", text: "Be a GPS trying to give {name} life directions.", heat: 1, format: "character", standalone: false },
];

export function bottlePrompt(name: string, exclude: string[] = []): Prompt {
  const pool = BOTTLE_DECK.filter((p) => !exclude.includes(p.id));
  const from = pool.length ? pool : BOTTLE_DECK;
  const chosen = from[Math.floor(Math.random() * from.length)];
  return { ...chosen, text: chosen.text.replaceAll("{name}", name) };
}

export function randomPrompt(exclude: string[] = []): Prompt {
  const pool = FREE_DECK.filter((p) => !exclude.includes(p.id));
  const from = pool.length ? pool : FREE_DECK;
  return from[Math.floor(Math.random() * from.length)];
}

/** Only standalone prompts — these clips get seen by strangers. */
export const DAILY_ELIGIBLE = FREE_DECK.filter((p) => p.standalone);

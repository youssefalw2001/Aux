/**
 * Free-tier prompt deck.
 *
 * Design rule: every prompt must be performable in under 30 seconds and be
 * funnier when heard than when read. If a prompt works as text, it belongs in
 * a different game — the voice is the point.
 *
 * Premium decks live server-side behind the group unlock.
 */

export interface Prompt {
  id: string;
  text: string;
  /** Rough spice level, 1 (safe) – 3 (edgy). Used for deck filtering. */
  heat: 1 | 2 | 3;
}

export const FREE_DECK: Prompt[] = [
  { id: "p1", text: "Leave a voicemail breaking up with someone over something extremely petty.", heat: 2 },
  { id: "p2", text: "Say “I'm not drunk” like you are extremely drunk.", heat: 2 },
  { id: "p3", text: "Record the most convincing fake apology you can manage.", heat: 2 },
  { id: "p4", text: "Do a customer service voice while delivering genuinely upsetting news.", heat: 1 },
  { id: "p5", text: "Narrate the last thing you ate like a nature documentary.", heat: 1 },
  { id: "p6", text: "Leave a voice note for your ex that is technically polite but absolutely devastating.", heat: 3 },
  { id: "p7", text: "Explain why you're late, but every excuse gets less believable.", heat: 1 },
  { id: "p8", text: "Do your best impression of someone in this group chat.", heat: 2 },
  { id: "p9", text: "Read your last text out loud in the voice of a Shakespearean villain.", heat: 1 },
  { id: "p10", text: "Confess to a crime you did not commit, with too much detail.", heat: 2 },
  { id: "p11", text: "Sell me something in your room like it's a late-night infomercial.", heat: 1 },
  { id: "p12", text: "Leave a hostage-negotiation voicemail about the aux cord.", heat: 2 },
  { id: "p13", text: "Say something nice about the person to your left in the most threatening tone possible.", heat: 2 },
  { id: "p14", text: "Do a weather forecast for your current emotional state.", heat: 1 },
  { id: "p15", text: "Give a TED talk intro for the worst decision you made this year.", heat: 3 },
];

/**
 * Spin the Bottle deck.
 *
 * Every prompt is directed at someone the bottle landed on — who is, by
 * definition, in the room and playing. `{name}` is substituted at render time.
 *
 * Design rule for this deck: the answer must be something you'd be happy to
 * have heard out loud by the group. The tension comes from anonymity and from
 * saying it in your real voice, not from targeting anyone.
 */
export const BOTTLE_DECK: Prompt[] = [
  { id: "b1", text: "Say the nicest thing you can about {name} — but you only get 10 seconds.", heat: 1 },
  { id: "b2", text: "What's the first thing you noticed about {name}?", heat: 2 },
  { id: "b3", text: "Tell {name} something you've never said out loud.", heat: 3 },
  { id: "b4", text: "If {name} texted you at 3am, what would it say?", heat: 2 },
  { id: "b5", text: "Describe {name} as a song. Sing a bit of it.", heat: 1 },
  { id: "b6", text: "What's {name}'s most unhinged quality, said lovingly?", heat: 2 },
  { id: "b7", text: "Give {name} a compliment so specific it's slightly alarming.", heat: 2 },
  { id: "b8", text: "What would {name}'s villain origin story be?", heat: 1 },
  { id: "b9", text: "Confess something you did that {name} never found out about.", heat: 3 },
  { id: "b10", text: "Hype {name} up like you're introducing them at a fight.", heat: 1 },
  { id: "b11", text: "What does {name} do that everyone notices but nobody mentions?", heat: 2 },
  { id: "b12", text: "Say something to {name} that would ruin the vibe in the best way.", heat: 3 },
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

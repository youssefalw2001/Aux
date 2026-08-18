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

export function randomPrompt(exclude: string[] = []): Prompt {
  const pool = FREE_DECK.filter((p) => !exclude.includes(p.id));
  const from = pool.length ? pool : FREE_DECK;
  return from[Math.floor(Math.random() * from.length)];
}

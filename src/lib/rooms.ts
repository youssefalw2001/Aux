import { randomPrompt } from "./prompts";

/**
 * Room data access.
 *
 * Currently returns deterministic mock data so the unfurl card and room shell
 * are fully renderable. The real implementation reads from the Durable Object
 * (one DO per room code) — see `worker/` once the room server lands.
 *
 * Kept behind this interface so swapping the backing store doesn't touch the
 * OG card or any UI.
 */

export interface RoomPreview {
  code: string;
  round: number;
  prompt: string;
  players: string[];
  /** Reveal is gated until this many players have joined. */
  minPlayers: number;
}

const MOCK_NAMES = ["Maya", "Dre", "Priya", "Sam", "Kofi", "Lena", "Tia"];

export async function getRoomPreview(code: string): Promise<RoomPreview> {
  // Deterministic from the code so the card is stable between fetches —
  // Instagram and other crawlers cache aggressively, and a card that changes
  // shape on every fetch looks broken.
  let h = 0;
  for (let i = 0; i < code.length; i++) {
    h = (h * 31 + code.charCodeAt(i)) | 0;
  }
  const count = 2 + (Math.abs(h) % 4);

  return {
    code: code.toUpperCase(),
    round: 1 + (Math.abs(h >> 3) % 3),
    prompt: randomPrompt().text,
    players: MOCK_NAMES.slice(0, count),
    minPlayers: 5,
  };
}

/** Room codes: unambiguous alphabet — no O/0, I/1, or S/5 confusion. */
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

export function generateRoomCode(length = 5): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

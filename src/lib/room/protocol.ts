/**
 * Wire protocol shared between the Next app and the Durable Object.
 *
 * Single source of truth — the worker imports this file directly so the client
 * and server can never drift.
 */

export type Phase = "lobby" | "recording" | "voting" | "reveal";

export interface PlayerView {
  /** Stable across reconnects. Derived from the device, not the socket. */
  id: string;
  name: string;
  connected: boolean;
  /** Has submitted a clip this round. */
  submitted: boolean;
  /** Has cast a vote this round. */
  voted: boolean;
}

export interface SubmissionView {
  playerId: string;
  /** Only populated once the phase reaches `voting`. */
  clipUrl?: string;
  peaks: number[];
  durationMs: number;
  /** Only populated at `reveal`. */
  votes?: number;
}

export interface RoomState {
  code: string;
  phase: Phase;
  round: number;
  prompt: string | null;
  players: PlayerView[];
  submissions: SubmissionView[];
  minPlayers: number;
  /** Epoch ms. Soft deadline for the current phase, if any. */
  deadlineAt: number | null;
  /** Player id(s) with the most votes. Populated at `reveal`. */
  winners: string[];
}

/* ---------------- client → server ---------------- */

export type ClientMessage =
  | { type: "join"; deviceId: string; name: string }
  | { type: "start" }
  | {
      type: "submit";
      clipUrl: string;
      peaks: number[];
      durationMs: number;
    }
  | { type: "vote"; targetId: string }
  | { type: "advance" };

/* ---------------- server → client ---------------- */

export type ServerMessage =
  | { type: "state"; state: RoomState }
  | { type: "you"; playerId: string }
  | { type: "error"; code: ErrorCode; message: string };

export type ErrorCode =
  | "room_full"
  | "bad_phase"
  | "not_joined"
  | "already_submitted"
  | "already_voted"
  | "self_vote"
  | "invalid_payload";

export const MAX_PLAYERS = 12;
export const MIN_PLAYERS = 3;

/** Soft deadlines. The round advances early when everyone acts — these only
 *  stop one AWOL player from stalling the whole room. */
export const RECORDING_WINDOW_MS = 5 * 60_000;
export const VOTING_WINDOW_MS = 2 * 60_000;

export function isClientMessage(v: unknown): v is ClientMessage {
  if (typeof v !== "object" || v === null) return false;
  const t = (v as { type?: unknown }).type;
  return (
    t === "join" ||
    t === "start" ||
    t === "submit" ||
    t === "vote" ||
    t === "advance"
  );
}

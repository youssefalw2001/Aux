import { Server, type Connection, type WSMessage } from "partyserver";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  RECORDING_WINDOW_MS,
  VOTING_WINDOW_MS,
  isClientMessage,
  type ErrorCode,
  type Phase,
  type RoomState,
  type ServerMessage,
} from "../src/lib/room/protocol";
import { FREE_DECK } from "../src/lib/prompts";

/**
 * One Durable Object per room code.
 *
 * Durable Objects are the right primitive here: single-threaded, globally
 * unique, with their own persistent storage. No Redis, no coordination layer,
 * no race conditions on vote counting — the object *is* the lock.
 *
 * Two design decisions that matter:
 *
 * 1. PLAYERS ARE KEYED BY DEVICE ID, NOT CONNECTION ID.
 *    Instagram's in-app WebView backgrounds aggressively and drops WebSockets
 *    constantly. Keying on the socket would spawn a ghost player on every
 *    reconnect and permanently break the "everyone has submitted" check.
 *    Reconnecting with the same deviceId resumes the same player.
 *
 * 2. THE ROUND ADVANCES ON THE LAST ACTION, NOT ON A TIMER.
 *    This is the async design from the plan — group chats aren't synchronous.
 *    Alarms exist only as a soft deadline so one AWOL player can't stall the
 *    room forever.
 */

interface Player {
  id: string; // deviceId
  name: string;
  connectionIds: Set<string>;
  joinedAt: number;
}

interface Submission {
  playerId: string;
  clipUrl: string;
  peaks: number[];
  durationMs: number;
  at: number;
}

interface Persisted {
  phase: Phase;
  round: number;
  prompt: string | null;
  players: Array<Omit<Player, "connectionIds">>;
  submissions: Submission[];
  votes: Record<string, string>; // voterId -> targetId
  deadlineAt: number | null;
  usedPromptIds: string[];
}

export class AuxRoom extends Server<Env> {
  static options = { hibernate: true };

  private phase: Phase = "lobby";
  private round = 0;
  private prompt: string | null = null;
  private players = new Map<string, Player>();
  private submissions: Submission[] = [];
  private votes = new Map<string, string>();
  private deadlineAt: number | null = null;
  private usedPromptIds: string[] = [];
  private loaded = false;

  /* ------------------------- persistence ------------------------- */

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    const saved = await this.ctx.storage.get<Persisted>("room");
    if (!saved) return;

    this.phase = saved.phase;
    this.round = saved.round;
    this.prompt = saved.prompt;
    this.submissions = saved.submissions ?? [];
    this.votes = new Map(Object.entries(saved.votes ?? {}));
    this.deadlineAt = saved.deadlineAt ?? null;
    this.usedPromptIds = saved.usedPromptIds ?? [];
    // Connections are not durable; every player starts disconnected and is
    // re-attached as sockets come back.
    for (const p of saved.players ?? []) {
      this.players.set(p.id, { ...p, connectionIds: new Set() });
    }
  }

  private async save() {
    const data: Persisted = {
      phase: this.phase,
      round: this.round,
      prompt: this.prompt,
      // Sockets aren't durable, so connectionIds is dropped on the way to storage
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        joinedAt: p.joinedAt,
      })),
      submissions: this.submissions,
      votes: Object.fromEntries(this.votes),
      deadlineAt: this.deadlineAt,
      usedPromptIds: this.usedPromptIds,
    };
    await this.ctx.storage.put("room", data);
  }

  /* ------------------------- lifecycle ------------------------- */

  async onStart() {
    await this.load();
  }

  async onConnect(connection: Connection) {
    await this.load();
    // The socket exists but isn't a player until it sends `join`.
    this.send(connection, { type: "state", state: this.view() });
  }

  async onClose(connection: Connection) {
    await this.load();
    for (const player of this.players.values()) {
      if (player.connectionIds.delete(connection.id)) break;
    }
    await this.save();
    this.broadcastState();
  }

  async onMessage(connection: Connection, raw: WSMessage) {
    await this.load();

    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : "");
    } catch {
      return this.fail(connection, "invalid_payload", "Malformed message.");
    }
    if (!isClientMessage(parsed)) {
      return this.fail(connection, "invalid_payload", "Unknown message type.");
    }

    switch (parsed.type) {
      case "join":
        return this.handleJoin(connection, parsed.deviceId, parsed.name);
      case "start":
        return this.handleStart(connection);
      case "submit":
        return this.handleSubmit(
          connection,
          parsed.clipUrl,
          parsed.peaks,
          parsed.durationMs,
        );
      case "vote":
        return this.handleVote(connection, parsed.targetId);
      case "advance":
        return this.handleAdvance(connection);
    }
  }

  /** Soft deadline. Advances whatever phase we're stuck in. */
  async onAlarm() {
    await this.load();
    if (this.deadlineAt === null || Date.now() < this.deadlineAt - 1_000) {
      return;
    }
    if (this.phase === "recording") {
      // Only advance if at least one clip exists, otherwise reset to lobby
      if (this.submissions.length > 0) await this.toVoting();
      else await this.toLobby();
    } else if (this.phase === "voting") {
      await this.toReveal();
    }
  }

  /* ------------------------- handlers ------------------------- */

  private async handleJoin(
    connection: Connection,
    deviceId: string,
    name: string,
  ) {
    const clean = (name ?? "").trim().slice(0, 16);
    if (!deviceId || !clean) {
      return this.fail(connection, "invalid_payload", "Name required.");
    }

    const existing = this.players.get(deviceId);
    if (existing) {
      // Reconnect — resume the same player, don't create a ghost.
      existing.connectionIds.add(connection.id);
      existing.name = clean;
    } else {
      if (this.players.size >= MAX_PLAYERS) {
        return this.fail(connection, "room_full", "This room is full.");
      }
      this.players.set(deviceId, {
        id: deviceId,
        name: clean,
        connectionIds: new Set([connection.id]),
        joinedAt: Date.now(),
      });
    }

    connection.setState({ playerId: deviceId });
    this.send(connection, { type: "you", playerId: deviceId });
    await this.save();
    this.broadcastState();
  }

  private async handleStart(connection: Connection) {
    if (this.phase !== "lobby") {
      return this.fail(connection, "bad_phase", "Round already running.");
    }
    if (this.players.size < MIN_PLAYERS) {
      return this.fail(
        connection,
        "bad_phase",
        `Need ${MIN_PLAYERS - this.players.size} more player(s).`,
      );
    }
    await this.toRecording();
  }

  private async handleSubmit(
    connection: Connection,
    clipUrl: string,
    peaks: number[],
    durationMs: number,
  ) {
    const playerId = this.playerIdFor(connection);
    if (!playerId) {
      return this.fail(connection, "not_joined", "Join the room first.");
    }
    if (this.phase !== "recording") {
      return this.fail(connection, "bad_phase", "Not accepting clips.");
    }
    if (this.submissions.some((s) => s.playerId === playerId)) {
      return this.fail(connection, "already_submitted", "Already sent one.");
    }
    if (typeof clipUrl !== "string" || !Array.isArray(peaks)) {
      return this.fail(connection, "invalid_payload", "Bad clip payload.");
    }

    this.submissions.push({
      playerId,
      clipUrl,
      // Cap the array so a malicious client can't bloat DO storage
      peaks: peaks.slice(0, 128).map((n) => Math.max(0, Math.min(1, +n || 0))),
      durationMs: Math.max(0, Math.min(60_000, +durationMs || 0)),
      at: Date.now(),
    });

    await this.save();

    // THE ASYNC RULE: advance the moment the last player submits.
    if (this.submissions.length >= this.activePlayerCount()) {
      await this.toVoting();
    } else {
      this.broadcastState();
    }
  }

  private async handleVote(connection: Connection, targetId: string) {
    const playerId = this.playerIdFor(connection);
    if (!playerId) {
      return this.fail(connection, "not_joined", "Join the room first.");
    }
    if (this.phase !== "voting") {
      return this.fail(connection, "bad_phase", "Not voting right now.");
    }
    if (this.votes.has(playerId)) {
      return this.fail(connection, "already_voted", "You already voted.");
    }
    if (targetId === playerId) {
      return this.fail(connection, "self_vote", "You can't vote for yourself.");
    }
    if (!this.submissions.some((s) => s.playerId === targetId)) {
      return this.fail(connection, "invalid_payload", "No such clip.");
    }

    this.votes.set(playerId, targetId);
    await this.save();

    // Everyone who submitted has now voted → reveal.
    if (this.votes.size >= this.submissions.length) {
      await this.toReveal();
    } else {
      this.broadcastState();
    }
  }

  private async handleAdvance(connection: Connection) {
    if (this.phase !== "reveal") {
      return this.fail(connection, "bad_phase", "Nothing to advance.");
    }
    await this.toRecording();
  }

  /* ------------------------- transitions ------------------------- */

  private async toLobby() {
    this.phase = "lobby";
    this.prompt = null;
    this.submissions = [];
    this.votes.clear();
    this.deadlineAt = null;
    await this.ctx.storage.deleteAlarm();
    await this.save();
    this.broadcastState();
  }

  private async toRecording() {
    this.phase = "recording";
    this.round += 1;
    this.submissions = [];
    this.votes.clear();
    this.prompt = this.nextPrompt();
    this.deadlineAt = Date.now() + RECORDING_WINDOW_MS;
    await this.ctx.storage.setAlarm(this.deadlineAt);
    await this.save();
    this.broadcastState();
  }

  private async toVoting() {
    this.phase = "voting";
    this.votes.clear();
    this.deadlineAt = Date.now() + VOTING_WINDOW_MS;
    await this.ctx.storage.setAlarm(this.deadlineAt);
    await this.save();
    this.broadcastState();
  }

  private async toReveal() {
    this.phase = "reveal";
    this.deadlineAt = null;
    await this.ctx.storage.deleteAlarm();
    await this.save();
    this.broadcastState();
  }

  /* ------------------------- helpers ------------------------- */

  private nextPrompt(): string {
    let pool = FREE_DECK.filter((p) => !this.usedPromptIds.includes(p.id));
    if (pool.length === 0) {
      this.usedPromptIds = [];
      pool = FREE_DECK;
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this.usedPromptIds.push(chosen.id);
    return chosen.text;
  }

  private playerIdFor(connection: Connection): string | null {
    const state = connection.state as { playerId?: string } | null;
    if (state?.playerId && this.players.has(state.playerId)) {
      return state.playerId;
    }
    // Fall back to a scan in case connection state was lost to hibernation
    for (const p of this.players.values()) {
      if (p.connectionIds.has(connection.id)) return p.id;
    }
    return null;
  }

  /** Players we expect to act this round — connected ones only, so a player
   *  who closed the tab doesn't block the reveal indefinitely. */
  private activePlayerCount(): number {
    const connected = [...this.players.values()].filter(
      (p) => p.connectionIds.size > 0,
    ).length;
    return Math.max(1, connected);
  }

  private tally(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const target of this.votes.values()) {
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    return counts;
  }

  private view(): RoomState {
    const counts = this.tally();
    const revealing = this.phase === "reveal";
    const showClips = this.phase === "voting" || revealing;

    let winners: string[] = [];
    if (revealing && counts.size > 0) {
      const top = Math.max(...counts.values());
      winners = [...counts.entries()]
        .filter(([, n]) => n === top)
        .map(([id]) => id);
    }

    return {
      code: this.name,
      phase: this.phase,
      round: this.round,
      prompt: this.prompt,
      minPlayers: MIN_PLAYERS,
      deadlineAt: this.deadlineAt,
      winners,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          id: p.id,
          name: p.name,
          connected: p.connectionIds.size > 0,
          submitted: this.submissions.some((s) => s.playerId === p.id),
          voted: this.votes.has(p.id),
        })),
      // Clip URLs are withheld during `recording` so nobody can listen to
      // other takes before committing their own.
      submissions: this.submissions.map((s) => ({
        playerId: s.playerId,
        clipUrl: showClips ? s.clipUrl : undefined,
        peaks: s.peaks,
        durationMs: s.durationMs,
        votes: revealing ? (counts.get(s.playerId) ?? 0) : undefined,
      })),
    };
  }

  private send(connection: Connection, msg: ServerMessage) {
    connection.send(JSON.stringify(msg));
  }

  private broadcastState() {
    const msg: ServerMessage = { type: "state", state: this.view() };
    this.broadcast(JSON.stringify(msg));
  }

  private fail(connection: Connection, code: ErrorCode, message: string) {
    this.send(connection, { type: "error", code, message });
  }
}

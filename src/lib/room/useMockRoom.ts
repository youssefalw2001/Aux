"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dailyPrompt } from "@/lib/daily";
import { randomPrompt } from "@/lib/prompts";
import { MIN_PLAYERS, type Phase, type RoomState } from "./protocol";

/**
 * Client-side simulation of a room.
 *
 * Exposes the same surface as `useRoom` so every stage component is
 * interchangeable between real and simulated play. Two jobs:
 *
 *  1. Lets the full phase cycle be demoed with no worker, no network, and no
 *     three other humans — which is what makes a static build viewable.
 *  2. Doubles as the development harness for reveal choreography, where
 *     wiring up real clips for every timing tweak is miserable.
 *
 * The bots deliberately act on staggered random delays rather than in lockstep,
 * because uniform timing hides the exact race conditions this UI has to absorb.
 */

const BOTS = [
  { id: "bot-maya", name: "Maya" },
  { id: "bot-dre", name: "Dre" },
  { id: "bot-priya", name: "Priya" },
] as const;

const ME = "you-local";

/** Plausible speech envelope so demo waveforms don't look synthetic. */
function fakePeaks(seed: number, n = 48): number[] {
  let h = seed * 2654435761;
  return Array.from({ length: n }, (_, i) => {
    h = (h ^ (h << 13)) >>> 0;
    h = (h ^ (h >>> 17)) >>> 0;
    const noise = ((h % 1000) / 1000) * 0.7 + 0.3;
    const envelope = Math.sin((i / n) * Math.PI) * 0.6 + 0.4;
    return Math.max(0.1, Math.min(1, noise * envelope));
  });
}

interface Sub {
  playerId: string;
  clipUrl: string;
  peaks: number[];
  durationMs: number;
}

export function useMockRoom(myName: string) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [round, setRound] = useState(0);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setSubs([]);
    setVotes({});
    setRound((r) => {
      const next = r + 1;
      // Round 1 is always the global daily prompt — that's the shared hook
      // everyone is playing on the same day. Later rounds are free play.
      setPrompt(next === 1 ? dailyPrompt().text : randomPrompt().text);
      return next;
    });
    setPhase("recording");
  }, [clearTimers]);

  /** Called when the local player sends their clip. Bots follow. */
  const submit = useCallback(
    (clipUrl: string, peaks: number[], durationMs: number) => {
      setSubs((prev) =>
        prev.some((s) => s.playerId === ME)
          ? prev
          : [...prev, { playerId: ME, clipUrl, peaks, durationMs }],
      );

      BOTS.forEach((bot, i) => {
        later(
          () => {
            setSubs((prev) =>
              prev.some((s) => s.playerId === bot.id)
                ? prev
                : [
                    ...prev,
                    {
                      playerId: bot.id,
                      clipUrl: "",
                      peaks: fakePeaks(i + 1),
                      durationMs: 5200 + i * 2600,
                    },
                  ],
            );
            // Last bot in → advance, mirroring the server's "last action" rule
            if (i === BOTS.length - 1) later(() => setPhase("voting"), 550);
          },
          700 + i * 850 + Math.random() * 500,
        );
      });
      return true;
    },
    [later],
  );

  const vote = useCallback(
    (targetId: string) => {
      setVotes((prev) => (prev[ME] ? prev : { ...prev, [ME]: targetId }));

      // Bots vote for someone other than themselves, weighted toward the
      // human's clip so the demo usually produces a clear winner.
      BOTS.forEach((bot, i) => {
        later(
          () => {
            setVotes((prev) => {
              if (prev[bot.id]) return prev;
              const candidates = [ME, ...BOTS.map((b) => b.id)].filter(
                (id) => id !== bot.id,
              );
              const pick =
                Math.random() < 0.55
                  ? ME
                  : candidates[Math.floor(Math.random() * candidates.length)];
              return { ...prev, [bot.id]: pick };
            });
            if (i === BOTS.length - 1) later(() => setPhase("reveal"), 500);
          },
          500 + i * 700 + Math.random() * 400,
        );
      });
      return true;
    },
    [later],
  );

  const advance = useCallback(() => start(), [start]);

  const state: RoomState = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of Object.values(votes)) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const revealing = phase === "reveal";
    const showClips = phase === "voting" || revealing;

    let winners: string[] = [];
    if (revealing && counts.size > 0) {
      const top = Math.max(...counts.values());
      winners = [...counts.entries()].filter(([, n]) => n === top).map(([id]) => id);
    }

    return {
      code: "DEMO",
      phase,
      round,
      prompt,
      minPlayers: MIN_PLAYERS,
      deadlineAt: null,
      winners,
      players: [
        {
          id: ME,
          name: myName || "You",
          connected: true,
          submitted: subs.some((s) => s.playerId === ME),
          voted: !!votes[ME],
        },
        ...BOTS.map((b) => ({
          id: b.id,
          name: b.name,
          connected: true,
          submitted: subs.some((s) => s.playerId === b.id),
          voted: !!votes[b.id],
        })),
      ],
      submissions: subs.map((s) => ({
        playerId: s.playerId,
        clipUrl: showClips ? s.clipUrl : undefined,
        peaks: s.peaks,
        durationMs: s.durationMs,
        votes: revealing ? (counts.get(s.playerId) ?? 0) : undefined,
      })),
    };
  }, [phase, round, prompt, subs, votes, myName]);

  return {
    state,
    playerId: ME,
    me: state.players[0],
    status: "open" as const,
    lastError: null,
    myVote: votes[ME] ?? null,
    start,
    submit,
    vote,
    advance,
  };
}

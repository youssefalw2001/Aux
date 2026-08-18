"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Waveform } from "./Waveform";
import { haptic } from "@/lib/haptics";
import { pop, snap, stagger, tap } from "@/lib/motion";
import { cn, formatDuration } from "@/lib/utils";
import type { PlayerView, SubmissionView } from "@/lib/room/protocol";

/**
 * Voting stage.
 *
 * Clips are presented ANONYMOUSLY — names are hidden until reveal. This is a
 * deliberate game-design call: attaching names during voting turns it into a
 * popularity contest, where hiding them makes people vote for the funniest
 * take. It also makes the reveal land harder, because the author is news.
 */

interface Props {
  submissions: SubmissionView[];
  players: PlayerView[];
  myId: string | null;
  votedFor: string | null;
  onVote: (playerId: string) => void;
}

export function VoteList({ submissions, myId, votedFor, onVote }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="mb-1 text-center">
        <div className="font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
          Pick the best one
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Names stay hidden until the reveal
        </p>
      </div>

      {submissions.map((sub, i) => {
        const isMine = sub.playerId === myId;
        const isVoted = votedFor === sub.playerId;
        const locked = votedFor !== null;

        return (
          <motion.div
            key={sub.playerId}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...pop, delay: stagger(i, 0.07) }}
            className={cn(
              "rounded-card border p-4 transition-colors",
              isVoted
                ? "border-acid bg-acid/10"
                : "border-line bg-surface/70 backdrop-blur-xl",
            )}
          >
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                transition={tap}
                onClick={() => {
                  haptic("tick");
                  setPlayingId(playingId === sub.playerId ? null : sub.playerId);
                }}
                aria-label="Play clip"
                className={cn(
                  "grid size-12 shrink-0 place-items-center rounded-full",
                  playingId === sub.playerId
                    ? "bg-acid text-void"
                    : "bg-surface-2 text-acid ring-1 ring-line-bright",
                )}
              >
                {playingId === sub.playerId ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <rect x="6.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" />
                    <rect x="13.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="currentColor" />
                  </svg>
                )}
              </motion.button>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">
                    Take {i + 1}
                    {isMine ? " · yours" : ""}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint tabular-nums">
                    {formatDuration(sub.durationMs)}
                  </span>
                </div>
                <Waveform
                  peaks={sub.peaks}
                  played={playingId === sub.playerId ? 0.45 : 0}
                  tone="acid"
                  className="h-8"
                  animateIn={false}
                />
              </div>
            </div>

            <motion.button
              type="button"
              disabled={isMine || locked}
              whileTap={{ scale: 0.97 }}
              transition={snap}
              onClick={() => {
                haptic("success");
                onVote(sub.playerId);
              }}
              className={cn(
                "mt-3 w-full rounded-pill py-3 text-sm font-semibold transition-colors",
                isVoted
                  ? "bg-acid text-void"
                  : isMine
                    ? "border border-line bg-transparent text-ink-faint"
                    : locked
                      ? "border border-line bg-transparent text-ink-faint"
                      : "border border-line-bright bg-surface-2 text-ink",
              )}
            >
              {isMine
                ? "Can't vote for yourself"
                : isVoted
                  ? "Voted ✓"
                  : locked
                    ? "—"
                    : "Vote for this"}
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}

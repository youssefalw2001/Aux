"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { RollingNumber } from "./RollingNumber";
import { Waveform } from "./Waveform";
import { haptic } from "@/lib/haptics";
import { heavy, pop, snap, tap } from "@/lib/motion";
import { cn, formatDuration } from "@/lib/utils";
import type { PlayerView, SubmissionView } from "@/lib/room/protocol";

/**
 * THE REVEAL. This is the money moment and the polish budget lives here.
 *
 * Sequenced, not dumped: results land one at a time from lowest votes upward,
 * so tension builds toward the winner instead of everything appearing at once.
 * The winner then gets a distinct crown beat with a ring burst.
 *
 * Everything is timed off a single `revealed` counter driven by an interval, so
 * the choreography stays readable and adjustable in one place.
 */

interface Props {
  submissions: SubmissionView[];
  players: PlayerView[];
  winners: string[];
  myId: string | null;
  prompt: string | null;
  onNext: () => void;
  onShare?: () => void;
}

const BEAT_MS = 900;

export function RevealStage({
  submissions,
  players,
  winners,
  myId,
  prompt,
  onNext,
  onShare,
}: Props) {
  // Lowest votes first so the winner lands last
  const ordered = [...submissions].sort((a, b) => (a.votes ?? 0) - (b.votes ?? 0));
  const [revealed, setRevealed] = useState(0);
  const done = revealed >= ordered.length;

  useEffect(() => {
    if (revealed >= ordered.length) return;
    const t = setTimeout(() => {
      setRevealed((n) => n + 1);
      haptic(revealed === ordered.length - 1 ? "success" : "tick");
    }, BEAT_MS);
    return () => clearTimeout(t);
  }, [revealed, ordered.length]);

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Someone";

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={pop}
          className="font-mono text-[11px] tracking-[0.24em] text-acid uppercase"
        >
          The results
        </motion.div>
        {prompt && (
          <p className="mt-2 px-4 text-sm leading-snug text-ink-dim">
            &ldquo;{prompt}&rdquo;
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {ordered.map((sub, i) => {
          const isRevealed = i < revealed;
          const isWinner = winners.includes(sub.playerId);
          const isMine = sub.playerId === myId;
          // Winner's crown beat fires only once every result is on screen
          const crowned = isWinner && done;

          return (
            <motion.div
              key={sub.playerId}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={
                isRevealed
                  ? { opacity: 1, y: 0, scale: crowned ? 1.02 : 1 }
                  : { opacity: 0, y: 24, scale: 0.95 }
              }
              transition={crowned ? heavy : pop}
              className={cn(
                "relative overflow-hidden rounded-card border p-4",
                crowned
                  ? "border-acid bg-acid/12"
                  : "border-line bg-surface/70 backdrop-blur-xl",
              )}
            >
              {/* Winner ring burst */}
              <AnimatePresence>
                {crowned && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-card border-2 border-acid"
                    initial={{ opacity: 0.9, scale: 0.9 }}
                    animate={{ opacity: 0, scale: 1.35 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold",
                    crowned
                      ? "bg-acid text-void"
                      : "bg-surface-2 text-ink ring-1 ring-line-bright",
                  )}
                >
                  {nameOf(sub.playerId).slice(0, 1).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "truncate text-base font-semibold",
                        crowned ? "text-acid" : "text-ink",
                      )}
                    >
                      {nameOf(sub.playerId)}
                    </span>
                    {isMine && (
                      <span className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                        you
                      </span>
                    )}
                    {crowned && <span className="text-base">👑</span>}
                  </div>
                  <div className="mt-1">
                    <Waveform
                      peaks={sub.peaks}
                      played={0}
                      tone={crowned ? "acid" : "cyan"}
                      className="h-7"
                      animateIn={false}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      "font-mono text-2xl leading-none tabular-nums",
                      crowned ? "text-acid" : "text-ink",
                    )}
                  >
                    {isRevealed ? (
                      <RollingNumber value={sub.votes ?? 0} duration={0.7} />
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="mt-1 font-mono text-[9px] tracking-widest text-ink-faint uppercase">
                    {(sub.votes ?? 0) === 1 ? "vote" : "votes"}
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-ink-faint tabular-nums">
                    {formatDuration(sub.durationMs)}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...pop, delay: 0.35 }}
            className="flex flex-col gap-3"
          >
            {onShare && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={tap}
                onClick={() => {
                  haptic("tap");
                  onShare();
                }}
                className="w-full rounded-pill bg-acid py-4 text-base font-semibold text-void"
              >
                Share the winner to your Story
              </motion.button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={snap}
              onClick={() => {
                haptic("tick");
                onNext();
              }}
              className="w-full rounded-pill border border-line-bright bg-surface py-4 text-base font-semibold text-ink-dim"
            >
              Next round
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

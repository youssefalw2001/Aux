"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Waveform } from "./Waveform";
import { haptic } from "@/lib/haptics";
import { pop, snap, stagger, tap } from "@/lib/motion";
import { cn, formatDuration } from "@/lib/utils";
import type { PlayerView, SubmissionView } from "@/lib/room/protocol";

/**
 * Anonymous reveal for Spin the Bottle.
 *
 * You hear what people said about you without knowing who said it. That
 * asymmetry is the whole hit — tbh and Gas both went to #1 on exactly this
 * nerve, and a real voice carries it far better than their text polls did,
 * because you get the hesitation and the laughing too.
 *
 * Authorship is a separate, opt-in beat at the end. Keeping the "who said that"
 * reveal behind a deliberate tap means the group decides together whether to
 * pop it, which is both a better moment and a safer default.
 */

interface Props {
  /** The player the bottle landed on. */
  subjectName: string;
  subjectId: string;
  submissions: SubmissionView[];
  players: PlayerView[];
  myId: string | null;
  prompt: string | null;
  onNext: () => void;
  onShare?: () => void;
}

export function AnonReveal({
  subjectName,
  subjectId,
  submissions,
  players,
  myId,
  prompt,
  onNext,
  onShare,
}: Props) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [authorsShown, setAuthorsShown] = useState(false);
  const aboutMe = subjectId === myId;

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Someone";

  return (
    <div className="flex w-full flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={pop}
        className="text-center"
      >
        <div className="font-mono text-[11px] tracking-[0.24em] text-acid uppercase">
          {aboutMe ? "About you" : `About ${subjectName}`}
        </div>
        {prompt && (
          <p className="mt-2 px-4 text-sm leading-snug text-ink-dim">
            &ldquo;{prompt}&rdquo;
          </p>
        )}
      </motion.div>

      <div className="flex flex-col gap-3">
        {submissions.map((sub, i) => {
          const isPlaying = playing === sub.playerId;
          return (
            <motion.div
              key={sub.playerId}
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...pop, delay: stagger(i, 0.1) }}
              className={cn(
                "rounded-card border p-4",
                isPlaying
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
                    setPlaying(isPlaying ? null : sub.playerId);
                  }}
                  aria-label="Play"
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-full",
                    isPlaying
                      ? "bg-acid text-void"
                      : "bg-surface-2 text-acid ring-1 ring-line-bright",
                  )}
                >
                  {isPlaying ? (
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
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={authorsShown ? "named" : "anon"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={snap}
                        className={cn(
                          "font-mono text-[10px] tracking-[0.2em] uppercase",
                          authorsShown ? "text-acid" : "text-ink-faint",
                        )}
                      >
                        {authorsShown
                          ? nameOf(sub.playerId)
                          : `Anonymous ${i + 1}`}
                      </motion.span>
                    </AnimatePresence>
                    <span className="font-mono text-[10px] text-ink-faint tabular-nums">
                      {formatDuration(sub.durationMs)}
                    </span>
                  </div>
                  <Waveform
                    peaks={sub.peaks}
                    played={isPlaying ? 0.45 : 0}
                    tone={authorsShown ? "cyan" : "acid"}
                    className="h-8"
                    animateIn={false}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...pop, delay: 0.4 }}
        className="flex flex-col gap-3"
      >
        {!authorsShown ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={snap}
            onClick={() => {
              haptic("success");
              setAuthorsShown(true);
            }}
            className="glow-acid w-full rounded-pill bg-acid py-4 text-base font-bold text-void"
          >
            Reveal who said what
          </motion.button>
        ) : (
          onShare && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.97 }}
              transition={tap}
              onClick={() => {
                haptic("tap");
                onShare();
              }}
              className="glow-acid w-full rounded-pill bg-acid py-4 text-base font-bold text-void"
            >
              Make it postable
            </motion.button>
          )
        )}
        <button
          onClick={() => {
            haptic("tick");
            onNext();
          }}
          className="w-full rounded-pill border border-line-bright bg-surface py-4 text-base font-semibold text-ink-dim"
        >
          Spin again
        </button>
      </motion.div>
    </div>
  );
}

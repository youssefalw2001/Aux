"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Kinetic type: the prompt lands word-by-word rather than fading in as a
 * block. This is the single cheapest way to make text feel like an event.
 *
 * Deliberately using Motion's stagger on a word split rather than pulling in
 * GSAP SplitText — per-word is enough drama here and keeps GSAP out of the
 * critical bundle. SplitText gets reserved for the reveal screen, where
 * per-glyph choreography actually earns its weight.
 */

interface Props {
  prompt: string;
  round?: number;
  totalRounds?: number;
  className?: string;
}

export function PromptCard({ prompt, round, totalRounds, className }: Props) {
  const words = prompt.split(" ");

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-card",
        "border border-line bg-surface/70 p-7 backdrop-blur-xl",
        className,
      )}
    >
      {/* Acid edge light along the top — implies the card is lit from within */}
      <div
        aria-hidden
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-acid to-transparent opacity-60"
      />

      {round !== undefined && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-acid uppercase"
        >
          <span className="inline-block size-1.5 rounded-full bg-acid" />
          Round {round}
          {totalRounds ? ` of ${totalRounds}` : null}
        </motion.div>
      )}

      <h1 className="display text-[clamp(1.75rem,7vw,2.5rem)] text-ink">
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block"
            initial={{ opacity: 0, y: "0.4em", filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              type: "spring",
              bounce: 0.34,
              duration: 0.7,
              delay: 0.06 * i,
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        ))}
      </h1>
    </div>
  );
}

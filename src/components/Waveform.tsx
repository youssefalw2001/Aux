"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The waveform is the brand. Voice is the product, so amplitude is the visual
 * motif everywhere — loaders, dividers, share cards, this.
 *
 * Bars animate in with a stagger on mount so a clip appearing feels like it
 * "lands" rather than just existing.
 */

interface Props {
  /** Normalised 0..1 amplitude samples. */
  peaks: number[];
  /** Fraction played, 0..1. Bars before this point read as active. */
  played?: number;
  onSeek?: (fraction: number) => void;
  className?: string;
  /** Skip the entrance stagger (e.g. re-renders during playback). */
  animateIn?: boolean;
  tone?: "acid" | "hot" | "cyan";
}

export function Waveform({
  peaks,
  played = 0,
  onSeek,
  className,
  animateIn = true,
  tone = "acid",
}: Props) {
  const activeTone = {
    acid: "bg-acid",
    hot: "bg-hot",
    cyan: "bg-cyan",
  }[tone];

  const handle = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div
      className={cn(
        "flex h-16 w-full items-center justify-between gap-[3px]",
        onSeek && "cursor-pointer",
        className,
      )}
      onPointerDown={handle}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Seek" : undefined}
      aria-valuenow={onSeek ? Math.round(played * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
    >
      {peaks.map((peak, i) => {
        const isActive = i / peaks.length <= played;
        /**
         * Floor at 12% so silence still reads as a waveform rather than a gap.
         *
         * Rounded to 2dp deliberately: with `animateIn={false}` Motion commits
         * the target value as the initial style, and full float precision
         * serialises differently on the server than on the client
         * ("42.2082%" vs "42.20821056955852%"), which React reports as a
         * hydration mismatch and resolves by throwing away the server HTML.
         */
        const height = `${(Math.max(0.12, peak) * 100).toFixed(2)}%`;

        return (
          <motion.div
            key={i}
            className={cn(
              "min-h-[3px] flex-1 rounded-full transition-colors duration-150",
              isActive ? activeTone : "bg-line-bright",
            )}
            initial={animateIn ? { height: "3px", opacity: 0 } : false}
            animate={{ height, opacity: 1 }}
            transition={{
              type: "spring",
              bounce: 0.4,
              duration: 0.5,
              delay: animateIn ? i * 0.008 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Idle/loading state built from the same motif, so loading feels like part of
 * the product rather than a spinner bolted on.
 */
export function WaveformPulse({ bars = 28 }: { bars?: number }) {
  return (
    <div className="flex h-16 w-full items-center justify-between gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="min-h-[3px] flex-1 rounded-full bg-acid-dim"
          animate={{ height: ["14%", "72%", "14%"] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: (i % 7) * 0.09,
          }}
        />
      ))}
    </div>
  );
}

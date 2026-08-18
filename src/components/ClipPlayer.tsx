"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Waveform } from "./Waveform";
import { haptic } from "@/lib/haptics";
import { pop, tap } from "@/lib/motion";
import { cn, formatDuration } from "@/lib/utils";

interface Props {
  url: string;
  peaks: number[];
  durationMs: number;
  label?: string;
  tone?: "acid" | "hot" | "cyan";
  className?: string;
}

export function ClipPlayer({
  url,
  peaks,
  durationMs,
  label,
  tone = "acid",
  className,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);

  // Progress is tracked on rAF rather than `timeupdate`, which only fires
  // ~4x/sec and makes the waveform crawl instead of glide.
  useEffect(() => {
    if (!playing) return;
    let raf: number;
    const loop = () => {
      const a = audioRef.current;
      if (a && a.duration && Number.isFinite(a.duration)) {
        setPlayed(a.currentTime / a.duration);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    haptic("tick");
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        // Autoplay/gesture rejection — surfaces as a no-op, user can retry
        setPlaying(false);
      }
    }
  };

  const seek = (fraction: number) => {
    const a = audioRef.current;
    if (!a || !a.duration || !Number.isFinite(a.duration)) return;
    a.currentTime = fraction * a.duration;
    setPlayed(fraction);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={pop}
      className={cn(
        "w-full rounded-card border border-line bg-surface/70 p-5 backdrop-blur-xl",
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onEnded={() => {
          setPlaying(false);
          setPlayed(0);
        }}
      />

      {label && (
        <div className="mb-3 font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">
          {label}
        </div>
      )}

      <div className="flex items-center gap-4">
        <motion.button
          type="button"
          onClick={toggle}
          whileTap={{ scale: 0.9 }}
          transition={tap}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-full",
            "bg-acid text-void outline-none",
            "focus-visible:ring-4 focus-visible:ring-acid/40",
          )}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </motion.button>

        <Waveform
          peaks={peaks}
          played={played}
          onSeek={seek}
          tone={tone}
          animateIn
          className="h-14"
        />

        <div className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-ink-dim">
          {formatDuration(durationMs)}
        </div>
      </div>
    </motion.div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="6.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" />
      <rect
        x="13.5"
        y="5.5"
        width="4"
        height="13"
        rx="1.6"
        fill="currentColor"
      />
    </svg>
  );
}

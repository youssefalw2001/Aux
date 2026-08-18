"use client";

import { motion } from "motion/react";
import { Waveform } from "./Waveform";
import { haptic } from "@/lib/haptics";
import { pop, tap } from "@/lib/motion";
import { formatAge, formatCount, type FeedClip } from "@/lib/feed";
import { cn, formatDuration } from "@/lib/utils";

/**
 * One clip in the global feed.
 *
 * The caption is the headline, not the prompt. Someone scrolling has no context
 * and no sound, so the caption has to land on its own — the prompt is supporting
 * detail underneath. Same reasoning as the share card: caption carries, audio is
 * the reward for stopping.
 */

interface Props {
  clip: FeedClip;
  rank: number;
  playing: boolean;
  liked: boolean;
  onPlay: () => void;
  onLike: () => void;
  index: number;
}

export function FeedItem({
  clip,
  rank,
  playing,
  liked,
  onPlay,
  onLike,
  index,
}: Props) {
  const podium = rank <= 3;

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...pop, delay: Math.min(index * 0.045, 0.4) }}
      className={cn(
        "card-lit rounded-card p-4",
        playing && "ring-1 ring-acid/40",
      )}
    >
      {/* --- top row: rank, author, meta --- */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold tabular-nums",
            podium
              ? "bg-acid text-void"
              : "bg-surface-2 text-ink-faint ring-1 ring-line",
          )}
        >
          {rank}
        </div>

        <div
          className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-void"
          style={{
            background: `oklch(0.82 0.15 ${clip.hue})`,
          }}
        >
          {clip.authorName.slice(0, 1)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">
              {clip.authorName}
            </span>
            {clip.isDaily && (
              <span className="shrink-0 rounded-pill border border-acid/40 bg-acid/10 px-2 py-0.5 font-mono text-[9px] tracking-widest text-acid uppercase">
                daily
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] tracking-wider text-ink-faint">
            {formatAge(clip.age)} ago · {formatCount(clip.plays)} plays
          </div>
        </div>
      </div>

      {/* --- the caption: the actual headline --- */}
      <p className="display mt-3 text-[1.35rem] leading-tight text-ink">
        {clip.caption}
      </p>

      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-faint">
        {clip.prompt}
      </p>

      {/* --- player --- */}
      <div className="mt-4 flex items-center gap-3">
        <motion.button
          type="button"
          onClick={() => {
            haptic("tick");
            onPlay();
          }}
          whileTap={{ scale: 0.9 }}
          transition={tap}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            playing ? "btn-lit text-void" : "btn-ghost-lit text-acid",
          )}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <rect x="6.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" />
              <rect x="13.5" y="5.5" width="4" height="13" rx="1.6" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5.5v13l11-6.5L8 5.5Z" fill="currentColor" />
            </svg>
          )}
        </motion.button>

        <Waveform
          peaks={clip.peaks}
          played={playing ? 0.42 : 0}
          tone={playing ? "acid" : "cyan"}
          className="h-9"
          animateIn={false}
        />

        <span className="w-9 shrink-0 text-right font-mono text-[10px] text-ink-faint tabular-nums">
          {formatDuration(clip.durationMs)}
        </span>
      </div>

      {/* --- actions --- */}
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <motion.button
          type="button"
          onClick={() => {
            haptic(liked ? "tick" : "success");
            onLike();
          }}
          whileTap={{ scale: 0.94 }}
          transition={tap}
          className={cn(
            "flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-mono text-[11px] tabular-nums transition-colors",
            liked
              ? "bg-acid/15 text-acid ring-1 ring-acid/40"
              : "text-ink-dim ring-1 ring-line",
          )}
        >
          {/* Inline SVG rather than ▲ / △ — Geist has no glyph for those and
              they render as tofu boxes. */}
          <UpvoteIcon filled={liked} />
          {formatCount(clip.votes + (liked ? 1 : 0))}
        </motion.button>

        <button className="rounded-pill px-3 py-1.5 font-mono text-[11px] text-ink-faint ring-1 ring-line">
          Share
        </button>
      </div>
    </motion.article>
  );
}


/** Upvote chevron. SVG because the Unicode triangles aren't in our typeface. */
export function UpvoteIcon({
  filled,
  size = 11,
}: {
  filled?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M6 1.6 11 9.6H1z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

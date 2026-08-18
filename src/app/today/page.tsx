"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Aurora } from "@/components/Aurora";
import { FeedItem } from "@/components/FeedItem";
import { MotionLink } from "@/components/MotionLink";
import { dailyNumber, dailyPrompt } from "@/lib/daily";
import { getFeed, type FeedRange } from "@/lib/feed";
import { haptic } from "@/lib/haptics";
import { pop, snap } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The global feed.
 *
 * The strategic point of this screen: it's the only surface a stranger can land
 * on. Rooms are private and invisible; this is watchable content for people who
 * have never played, which is the entire path to distribution.
 *
 * It also closes the loop on the daily prompt — you hear today's best takes,
 * which is the strongest possible argument for recording your own.
 */

const RANGES: Array<{ id: FeedRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All time" },
];

export default function TodayPage() {
  const [range, setRange] = useState<FeedRange>("today");
  const [playing, setPlaying] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const clips = useMemo(() => getFeed(range), [range]);
  const prompt = dailyPrompt().text;

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <Aurora />
      {/* pb-40 clears the sticky CTA — at pb-32 the button sat on top of the
          last card's action row on shorter viewports. */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-40">
        {/* ---------- header ---------- */}
        <header className="flex items-center justify-between py-6">
          <MotionLink href="/" className="display text-2xl text-acid text-glow-acid">
            aux
          </MotionLink>
          <div className="flex items-center gap-2 rounded-pill border border-line bg-surface/60 px-3 py-1.5 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-acid" />
            </span>
            <span className="font-mono text-[11px] tracking-widest text-ink-dim">
              LIVE
            </span>
          </div>
        </header>

        {/* ---------- today's prompt ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={pop}
          className="card-lit rounded-card p-5"
        >
          <div className="font-mono text-[10px] tracking-[0.22em] text-acid uppercase">
            Daily #{dailyNumber()} · everyone, worldwide
          </div>
          <h1 className="display mt-2 text-[1.5rem] leading-tight text-ink">
            {prompt}
          </h1>
        </motion.div>

        {/* ---------- range tabs ---------- */}
        <div className="mt-6 flex gap-2">
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  haptic("tick");
                  setRange(r.id);
                  setPlaying(null);
                }}
                className={cn(
                  "relative rounded-pill px-4 py-2 font-mono text-[11px] tracking-wider uppercase transition-colors",
                  active ? "text-void" : "text-ink-faint ring-1 ring-line",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="range-pill"
                    transition={snap}
                    className="btn-lit absolute inset-0 rounded-pill"
                  />
                )}
                <span className="relative">{r.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 mb-4 font-mono text-[10px] tracking-widest text-ink-faint uppercase">
          Top takes · ranked by votes, decayed by age
        </div>

        {/* ---------- feed ---------- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={range}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-3"
          >
            {clips.map((clip, i) => (
              <FeedItem
                key={clip.id}
                clip={clip}
                rank={i + 1}
                index={i}
                playing={playing === clip.id}
                liked={liked.has(clip.id)}
                onPlay={() =>
                  setPlaying(playing === clip.id ? null : clip.id)
                }
                onLike={() => toggleLike(clip.id)}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        <p className="mt-8 text-center text-[11px] tracking-wider text-ink-faint uppercase">
          Sample feed · simulated clips
        </p>
      </main>

      {/* ---------- sticky CTA ----------
          The feed's job is to make you want to post. The button follows you
          down the whole scroll rather than waiting at the bottom. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-void via-void/90 to-transparent pt-10 pb-6">
        <div className="pointer-events-auto mx-auto w-full max-w-md px-5">
          {/* MotionLink, not <MotionLink><motion.span whileTap> — that nesting eats
              the click and the button goes nowhere. See MotionLink. */}
          <MotionLink
            href="/demo"
            className="btn-lit block w-full rounded-pill py-4 text-center text-base font-bold text-void"
          >
            Record today&apos;s prompt
          </MotionLink>
        </div>
      </div>
    </>
  );
}

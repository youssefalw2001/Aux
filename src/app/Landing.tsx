"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Aurora } from "@/components/Aurora";
import { UpvoteIcon } from "@/components/FeedItem";
import { MotionLink } from "@/components/MotionLink";
import { WaveformPulse } from "@/components/Waveform";
import {
  dailyNumber,
  dailyPrompt,
  formatCountdown,
  msUntilNextDaily,
} from "@/lib/daily";
import { getFeed } from "@/lib/feed";
import { pop, stagger } from "@/lib/motion";

/**
 * Landing. One job: get someone into a round in one tap.
 *
 * Order is deliberate — hero, then today's prompt, then the two game buttons,
 * then social proof. Anything that isn't the daily hook or a play button is
 * below the fold, because most arrivals come from a group chat link and will
 * decide in about two seconds.
 */

const STEPS = [
  {
    n: "01",
    title: "A prompt drops",
    body: "Same one for everyone, worldwide, once a day.",
  },
  {
    n: "02",
    title: "Everyone records",
    body: "30 seconds in the app. No typing, no overthinking.",
  },
  {
    n: "03",
    title: "The group votes",
    body: "Takes stay anonymous until the reveal. Then it gets loud.",
  },
];

export function Landing({ playHref }: { playHref: string }) {
  return (
    <>
      <Aurora />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-9 px-5 py-10">
        <Hero />
        <DailyCard />
        <PlayButtons playHref={playHref} />
        <Ticker />
        <HowItWorks />
        <Footer />
      </main>
    </>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={pop}
      className="pt-4 text-center"
    >
      <div className="display text-[5.5rem] leading-none text-acid text-glow-acid">
        aux
      </div>
      <h1 className="display mt-4 text-[clamp(1.6rem,7.5vw,2.3rem)] text-ink">
        The voice note party game
      </h1>
      <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-relaxed text-ink-dim">
        A prompt drops. Everyone records. The group votes on who did it best.
      </p>

      <motion.div
        initial={{ opacity: 0, scaleY: 0.3 }}
        animate={{ opacity: 0.5, scaleY: 1 }}
        transition={{ ...pop, delay: 0.18 }}
        className="mt-7 px-1"
      >
        <WaveformPulse bars={38} />
      </motion.div>
    </motion.div>
  );
}

function DailyCard() {
  /**
   * Countdown starts null and fills after mount. This page is prerendered — the
   * static export bakes HTML at build time — so seeding it during render would
   * emit a value stale by however long ago the build ran, and React would throw
   * away the server HTML on hydration.
   */
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(msUntilNextDaily());
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...pop, delay: 0.22 }}
      className="card-lit rounded-card p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.22em] text-acid uppercase">
            Daily #{dailyNumber()}
          </div>
          <p className="display mt-2 text-[1.3rem] leading-tight text-ink">
            {dailyPrompt().text}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-xs text-ink tabular-nums">
            {remaining === null ? "—" : formatCountdown(remaining)}
          </div>
          <div className="mt-0.5 font-mono text-[9px] tracking-widest text-ink-faint uppercase">
            next drop
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PlayButtons({ playHref }: { playHref: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...pop, delay: 0.28 }}
      className="flex flex-col gap-3"
    >
      <MotionLink
        href="/demo/bottle"
        prefetch
        className="btn-lit block w-full rounded-pill py-5 text-center text-lg font-bold text-void"
      >
        Spin the Bottle
      </MotionLink>

      <div className="grid grid-cols-2 gap-3">
        <MotionLink
          href={playHref}
          prefetch
          className="btn-ghost-lit block w-full rounded-pill py-4 text-center text-sm font-semibold text-ink ring-1 ring-line-bright"
        >
          Voice Roulette
        </MotionLink>
        <MotionLink
          href="/today"
          prefetch
          className="btn-ghost-lit block w-full rounded-pill py-4 text-center text-sm font-semibold text-ink ring-1 ring-line-bright"
        >
          Top takes
        </MotionLink>
      </div>

      <p className="text-center text-[11px] tracking-[0.18em] text-ink-faint uppercase">
        Playable demo · simulated players · nothing uploaded
      </p>
    </motion.div>
  );
}

/**
 * Live ticker of the day's captions.
 *
 * Social proof that costs no vertical space, and it advertises the artifact:
 * these are real captions from real clips, which is what someone would actually
 * see on a Story. Duplicated once so the marquee loops seamlessly at -50%.
 */
function Ticker() {
  const items = getFeed("today").slice(0, 8);
  const doubled = [...items, ...items];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="edge-fade-x -mx-5 overflow-hidden"
    >
      <div className="marquee-track gap-3">
        {doubled.map((clip, i) => (
          <MotionLink
            key={`${clip.id}-${i}`}
            href="/today"
            className="flex shrink-0 items-center gap-2.5 rounded-pill border border-line bg-surface/60 px-4 py-2.5 backdrop-blur"
          >
            <span
              className="grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-void"
              style={{ background: `oklch(0.82 0.15 ${clip.hue})` }}
            >
              {clip.authorName.slice(0, 1)}
            </span>
            <span className="text-xs whitespace-nowrap text-ink-dim">
              {clip.caption}
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-acid tabular-nums">
              <UpvoteIcon filled size={9} />
              {clip.votes}
            </span>
          </MotionLink>
        ))}
      </div>
    </motion.div>
  );
}

function HowItWorks() {
  return (
    <div className="flex flex-col gap-3">
      {STEPS.map((step, i) => (
        <motion.div
          key={step.n}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...pop, delay: stagger(i, 0.09, 0.55) }}
          className="card-lit flex gap-4 rounded-card p-5"
        >
          <div className="font-mono text-xs text-acid">{step.n}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{step.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">
              {step.body}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="flex flex-col items-center gap-3 pb-4 text-center"
    >
      <MotionLink
        href="/r/PARTY"
        className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase underline decoration-line-bright underline-offset-4"
      >
        See a room invite →
      </MotionLink>
    </motion.div>
  );
}

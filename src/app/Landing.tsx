"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { WaveformPulse } from "@/components/Waveform";
import {
  dailyNumber,
  formatCountdown,
  msUntilNextDaily,
} from "@/lib/daily";
import { haptic } from "@/lib/haptics";
import { pop, snap, stagger } from "@/lib/motion";

/**
 * Landing. One job: get someone into a round in one tap.
 *
 * Deliberately short. The product is the game, not the pitch — every extra
 * section here is a chance to lose someone who arrived from a group chat.
 */

/**
 * The daily strip. Deliberately the first thing under the hero, because the
 * daily prompt is the reason to come back — a room-only game gives someone no
 * reason to ever open the app unless a friend drags them in.
 */
function DailyStrip() {
  /**
   * Starts as null and fills in after mount. This page is prerendered — in the
   * static export target the HTML is baked at build time — so seeding the
   * countdown during render would emit a value that's stale by however long ago
   * the build ran, and React would discard the server HTML on hydration.
   */
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(msUntilNextDaily());
    const raf = requestAnimationFrame(tick);
    const t = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="flex items-center justify-between rounded-card border border-acid/30 bg-acid/[0.06] px-5 py-4">
      <div>
        <div className="font-mono text-[10px] tracking-[0.22em] text-acid uppercase">
          Daily #{dailyNumber()}
        </div>
        <div className="mt-1 text-xs text-ink-dim">
          One prompt. Everyone. Worldwide.
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm text-ink tabular-nums">
          {remaining === null ? "—" : formatCountdown(remaining)}
        </div>
        <div className="font-mono text-[10px] tracking-widest text-ink-faint uppercase">
          next drop
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "A prompt drops",
    body: "“Leave a voicemail breaking up with someone over something petty.”",
  },
  {
    n: "02",
    title: "Everyone records",
    body: "30 seconds, in the app. No typing, no overthinking.",
  },
  {
    n: "03",
    title: "The group votes",
    body: "Takes stay anonymous until the reveal. Then it gets loud.",
  },
];

export function Landing({ playHref }: { playHref: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-5 py-12">
      {/* ---------- Hero ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={pop}
        className="text-center"
      >
        <div className="display text-7xl text-acid text-glow-acid">aux</div>
        <h1 className="display mt-5 text-[clamp(1.5rem,7vw,2.15rem)] text-ink">
          The voice note party game
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-dim">
          A prompt drops. Everyone records. The group votes on who did it best.
        </p>
      </motion.div>

      {/* ---------- Waveform ---------- */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0.4 }}
        animate={{ opacity: 0.55, scaleY: 1 }}
        transition={{ ...pop, delay: 0.15 }}
        className="px-2"
      >
        <WaveformPulse bars={36} />
      </motion.div>

      {/* ---------- Daily hook ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...pop, delay: 0.2 }}
      >
        <DailyStrip />
      </motion.div>

      {/* ---------- Primary CTA ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...pop, delay: 0.25 }}
        className="flex flex-col gap-3"
      >
        <Link href="/demo/bottle" prefetch onClick={() => haptic("tap")}>
          <motion.span
            whileTap={{ scale: 0.97 }}
            transition={snap}
            className="glow-acid block w-full rounded-pill bg-acid py-5 text-center text-lg font-bold text-void"
          >
            Spin the Bottle
          </motion.span>
        </Link>
        <Link href={playHref} prefetch onClick={() => haptic("tick")}>
          <motion.span
            whileTap={{ scale: 0.97 }}
            transition={snap}
            className="block w-full rounded-pill border border-line-bright bg-surface py-4 text-center text-base font-semibold text-ink"
          >
            Voice Roulette
          </motion.span>
        </Link>
        <p className="text-center text-[11px] tracking-[0.18em] text-ink-faint uppercase">
          Playable demo · simulated players · nothing uploaded
        </p>
      </motion.div>

      {/* ---------- How it works ---------- */}
      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...pop, delay: stagger(i, 0.09, 0.35) }}
            className="flex gap-4 rounded-card border border-line bg-surface/60 p-5 backdrop-blur-xl"
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

      {/* ---------- Secondary: see the unfurl card ---------- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center"
      >
        <Link
          href="/r/PARTY"
          className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase underline decoration-line-bright underline-offset-4"
        >
          See a room invite →
        </Link>
      </motion.div>
    </main>
  );
}

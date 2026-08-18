"use client";

import { motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { pop } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { PlayerView } from "@/lib/room/protocol";

/**
 * Spin the Bottle — the pick moment.
 *
 * The bottle only ever lands on someone IN the room. Everyone in the circle
 * joined, so everyone consented to being picked, and the payoff happens in the
 * app rather than as an obligation pointed at somebody who isn't playing.
 *
 * The spin is deliberately over-engineered because it's the beat everyone
 * watches together in silence. Three things make it feel real rather than like
 * a loading spinner:
 *
 *  1. The target is chosen FIRST, then the rotation is computed backwards from
 *     it. Spinning "randomly" and reading off the result gives you off-centre
 *     landings and rounding drift.
 *  2. It overshoots slightly and settles back, like a real bottle losing
 *     momentum against friction.
 *  3. Multiple full turns before the deceleration, so the outcome stays
 *     genuinely unreadable until the last half-second.
 */

interface Props {
  players: PlayerView[];
  /** Excluded from selection — usually whoever was picked last round. */
  excludeId?: string | null;
  onLanded: (playerId: string) => void;
  autoStart?: boolean;
}

const TURNS = 5;
const DURATION = 3.4;

export function BottleSpin({
  players,
  excludeId,
  onLanded,
  autoStart = false,
}: Props) {
  const [scope, animate] = useAnimate();
  const [spinning, setSpinning] = useState(false);
  const [landedId, setLandedId] = useState<string | null>(null);
  const rotationRef = useRef(0);

  // Held in refs so the autoStart effect doesn't re-fire every time the parent
  // re-renders and hands us fresh function/array identities. Synced in an
  // effect rather than during render — writing refs mid-render is a genuine
  // violation, not a style preference, because it breaks under concurrent
  // rendering where a render can be discarded.
  const onLandedRef = useRef(onLanded);
  const playersRef = useRef(players);
  const excludeRef = useRef(excludeId);

  // Declared before the autoStart effect so it runs first on mount.
  useEffect(() => {
    onLandedRef.current = onLanded;
    playersRef.current = players;
    excludeRef.current = excludeId;
  });

  const size = 300;
  const radius = size / 2 - 34;

  /**
   * @param isCancelled lets the caller abandon the sequence mid-flight. Needed
   *   because React runs effects twice in development: the first pass animates
   *   a node that is then detached, so without a cancellation path the second
   *   pass either double-animates or (with a naive ref guard) never runs at all
   *   and the bottle sits frozen at 0°.
   */
  const runSpin = async (isCancelled: () => boolean = () => false) => {
    const list = playersRef.current;
    if (list.length === 0) return;

    setSpinning(true);
    setLandedId(null);
    haptic("tap");

    // Pick the winner first, then solve for the angle that points at them.
    // Spinning by a random amount and reading off the result gives off-centre
    // landings and accumulates rounding drift over rounds.
    const pool = list.filter((p) => p.id !== excludeRef.current);
    const from = pool.length ? pool : list;
    const target = from[Math.floor(Math.random() * from.length)];
    const index = list.findIndex((p) => p.id === target.id);
    const step = 360 / list.length;

    // Avatars start at 12 o'clock going clockwise, and the bottle's nose points
    // up at rotation 0, so the target angle is just the avatar's own angle.
    const targetAngle = index * step;
    const current = rotationRef.current % 360;
    const delta = (targetAngle - current + 360) % 360;
    const final = rotationRef.current + TURNS * 360 + delta;

    try {
      // Overshoot, then settle back — the bottle fighting friction.
      await animate(
        scope.current,
        { rotate: final + 9 },
        { duration: DURATION, ease: [0.12, 0.62, 0.06, 1] },
      );
      if (isCancelled()) return;
      await animate(
        scope.current,
        { rotate: final },
        { type: "spring", stiffness: 90, damping: 12, mass: 1.1 },
      );
    } catch {
      // Animation interrupted by unmount — nothing to report
      return;
    }
    if (isCancelled()) return;

    rotationRef.current = final;
    setLandedId(target.id);
    setSpinning(false);
    haptic("success");
    onLandedRef.current(target.id);
  };

  useEffect(() => {
    if (!autoStart) return;
    let cancelled = false;
    void runSpin(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="flex flex-col items-center gap-7">
      <div
        className="relative grid place-items-center"
        style={{ width: size, height: size }}
      >
        {/* Ring */}
        <div
          aria-hidden
          className="absolute rounded-full border border-line"
          style={{ width: size - 20, height: size - 20 }}
        />

        {/* Bloom under the bottle while spinning */}
        <motion.div
          aria-hidden
          className="absolute rounded-full bg-acid blur-3xl"
          style={{ width: 140, height: 140 }}
          animate={{ opacity: spinning ? 0.35 : 0.12 }}
          transition={{ duration: 0.4 }}
        />

        {/* Players around the circle */}
        {players.map((p, i) => {
          const angle = (i * 360) / players.length - 90; // -90 → start at top
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          const isLanded = landedId === p.id;

          return (
            <motion.div
              key={p.id}
              className="absolute"
              style={{ x, y }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: isLanded ? 1.22 : 1,
                opacity: 1,
              }}
              transition={{ ...pop, delay: landedId ? 0 : i * 0.06 }}
            >
              <div
                className={cn(
                  "grid size-12 place-items-center rounded-full text-sm font-bold transition-colors duration-300",
                  isLanded
                    ? "glow-acid bg-acid text-void"
                    : "bg-surface-2 text-ink ring-1 ring-line-bright",
                )}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div
                className={cn(
                  "mt-1.5 max-w-16 truncate text-center text-[10px] transition-colors",
                  isLanded ? "text-acid" : "text-ink-faint",
                )}
              >
                {p.name}
              </div>
            </motion.div>
          );
        })}

        {/* The bottle */}
        <div ref={scope} className="absolute grid place-items-center">
          <svg width="34" height="132" viewBox="0 0 34 132" aria-hidden>
            <defs>
              <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8fb01c" />
                <stop offset="45%" stopColor="#c5f327" />
                <stop offset="100%" stopColor="#6d8a12" />
              </linearGradient>
            </defs>
            {/* neck */}
            <rect x="13" y="4" width="8" height="34" rx="4" fill="url(#glass)" />
            {/* shoulder + body */}
            <path
              d="M13 36c0 6-9 10-9 22v58a8 8 0 0 0 8 8h10a8 8 0 0 0 8-8V58c0-12-9-16-9-22z"
              fill="url(#glass)"
            />
            {/* highlight */}
            <rect
              x="9"
              y="54"
              width="3"
              height="56"
              rx="1.5"
              fill="#eaffb0"
              opacity="0.5"
            />
            {/* pour spout marker so the "nose" is unambiguous */}
            <circle cx="17" cy="6" r="4" fill="#eaffb0" />
          </svg>
        </div>
      </div>

      {!autoStart && (
        <motion.button
          type="button"
          onClick={() => void runSpin()}
          disabled={spinning}
          whileTap={{ scale: 0.96 }}
          className="rounded-pill bg-acid px-10 py-4 text-base font-bold text-void disabled:opacity-40"
        >
          {spinning ? "Spinning…" : landedId ? "Spin again" : "Spin the bottle"}
        </motion.button>
      )}

      <div className="h-6">
        {spinning && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[11px] tracking-[0.24em] text-ink-faint uppercase"
          >
            no takebacks
          </motion.p>
        )}
      </div>
    </div>
  );
}

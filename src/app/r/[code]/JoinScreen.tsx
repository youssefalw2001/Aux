"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { WaveformPulse } from "@/components/Waveform";
import { haptic } from "@/lib/haptics";
import { pop, snap, stagger } from "@/lib/motion";
import type { RoomPreview } from "@/lib/rooms";

/**
 * Join flow. One tap, one field, no account.
 *
 * The "N more to unlock" line is load-bearing: it's the same message as the
 * unfurl card, so the promise the reader saw in the group chat is confirmed
 * the instant they arrive. It also makes inviting the obvious next action
 * rather than a nag.
 */

export function JoinScreen({ room }: { room: RoomPreview }) {
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const needed = Math.max(0, room.minPlayers - room.players.length);

  const join = () => {
    if (!name.trim()) return;
    haptic("success");
    setJoining(true);
    // TODO: open the WebSocket to the room's Durable Object and join
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={pop}
        className="flex flex-col gap-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="display text-3xl text-acid text-glow-acid">aux</div>
          <div className="font-mono text-[11px] tracking-[0.28em] text-ink-faint uppercase">
            Room {room.code}
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface/70 p-7 backdrop-blur-xl">
          <div className="mb-5 font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
            Round {room.round} · Voice Roulette
          </div>

          <h1 className="display text-[clamp(1.5rem,6vw,2rem)] text-ink">
            {room.prompt}
          </h1>

          <div className="my-7 opacity-40">
            <WaveformPulse bars={32} />
          </div>

          {/* Who's already here — social proof, and the reason to tap */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {room.players.slice(0, 5).map((p, i) => (
                <motion.div
                  key={p}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...pop, delay: stagger(i, 0.06, 0.15) }}
                  className="grid size-9 place-items-center rounded-full border-2 border-void bg-surface-2 text-xs font-semibold text-ink"
                >
                  {p.slice(0, 1).toUpperCase()}
                </motion.div>
              ))}
            </div>
            <p className="text-sm text-ink-dim">
              {room.players.slice(0, 2).join(", ")}
              {room.players.length > 2
                ? ` +${room.players.length - 2} more`
                : ""}
            </p>
          </div>
        </div>

        {!joining ? (
          <div className="flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && join()}
              placeholder="Your name"
              maxLength={16}
              autoComplete="off"
              autoCapitalize="words"
              className="w-full rounded-pill border border-line-bright bg-surface px-6 py-4 text-center text-base text-ink placeholder:text-ink-faint focus:border-acid focus:outline-none"
            />
            <motion.button
              type="button"
              onClick={join}
              disabled={!name.trim()}
              whileTap={{ scale: 0.97 }}
              transition={snap}
              className="w-full rounded-pill bg-acid py-4 text-base font-semibold text-void disabled:opacity-30"
            >
              Join the round
            </motion.button>
            {needed > 0 && (
              <p className="text-center text-xs tracking-widest text-ink-faint uppercase">
                {needed} more to unlock the reveal
              </p>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="text-sm text-ink-dim">
              Joining as{" "}
              <span className="font-semibold text-acid">{name}</span>…
            </p>
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}

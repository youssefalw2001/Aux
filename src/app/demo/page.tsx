"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { PromptCard } from "@/components/PromptCard";
import { RecordButton } from "@/components/RecordButton";
import { RevealStage } from "@/components/RevealStage";
import { ShareSheet } from "@/components/ShareSheet";
import { VoteList } from "@/components/VoteList";
import { WaveformPulse } from "@/components/Waveform";
import { useRecorder } from "@/lib/audio/useRecorder";
import { dailyNumber } from "@/lib/daily";
import { haptic } from "@/lib/haptics";
import { pop, snap, stagger } from "@/lib/motion";
import { useMockRoom } from "@/lib/room/useMockRoom";
import { cn } from "@/lib/utils";

/**
 * Self-contained playable demo — no worker, no network, no other humans.
 *
 * Uses `useMockRoom` (simulated opponents) behind the exact same stage
 * components the real game uses, so this doubles as the design reference and
 * as something that survives a static export for preview hosting.
 */

const MAX_MS = 30_000;

export default function DemoPage() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return <NameGate name={name} setName={setName} onJoin={() => setJoined(true)} />;
  }
  return <DemoRoom myName={name} />;
}

function NameGate({
  name,
  setName,
  onJoin,
}: {
  name: string;
  setName: (v: string) => void;
  onJoin: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={pop}
        className="flex flex-col gap-7"
      >
        <div className="text-center">
          <div className="display text-5xl text-acid text-glow-acid">aux</div>
          <p className="mt-3 text-sm text-ink-dim">The voice note party game</p>
        </div>

        <div className="rounded-card border border-line bg-surface/70 p-6 backdrop-blur-xl">
          <div className="opacity-50">
            <WaveformPulse bars={30} />
          </div>
          <p className="mt-5 text-center text-sm leading-relaxed text-ink-dim">
            A prompt drops. Everyone records a voice note. The group votes on
            who did it best.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && onJoin()}
            placeholder="Your name"
            maxLength={16}
            autoComplete="off"
            className="w-full rounded-pill border border-line-bright bg-surface px-6 py-4 text-center text-base text-ink placeholder:text-ink-faint focus:border-acid focus:outline-none"
          />
          <motion.button
            type="button"
            onClick={() => {
              haptic("success");
              onJoin();
            }}
            disabled={!name.trim()}
            whileTap={{ scale: 0.97 }}
            transition={snap}
            className="w-full rounded-pill bg-acid py-4 text-base font-semibold text-void disabled:opacity-30"
          >
            Play the demo
          </motion.button>
          <p className="text-center text-[11px] tracking-wider text-ink-faint uppercase">
            Simulated players · nothing is uploaded
          </p>
        </div>
      </motion.div>
    </main>
  );
}

function DemoRoom({ myName }: { myName: string }) {
  const room = useMockRoom(myName);
  const { state } = room;

  const rec = useRecorder({
    maxDurationMs: MAX_MS,
    onComplete: () => haptic("success"),
  });

  const [sent, setSent] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const send = () => {
    if (!rec.recording) return;
    haptic("success");
    setSent(true);
    room.submit(
      rec.recording.url,
      rec.recording.peaks,
      rec.recording.durationMs,
    );
  };

  const nextRound = () => {
    rec.reset();
    setSent(false);
    setShareOpen(false);
    room.advance();
  };

  // Only the local player's clip has real audio in the simulation, so the video
  // export is offered when they won and falls back to an image otherwise.
  const winnerId = state.winners[0] ?? null;
  const winnerSub = state.submissions.find((s) => s.playerId === winnerId);
  const winnerName =
    state.players.find((p) => p.id === winnerId)?.name ?? "Someone";
  const winnerAudio =
    winnerId === room.playerId ? (rec.recording?.url ?? null) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-12">
      <Header state={state} />

      <AnimatePresence mode="wait">
        {/* ---------------- LOBBY ---------------- */}
        {state.phase === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={snap}
            className="flex flex-1 flex-col justify-center gap-7"
          >
            <div className="rounded-card border border-line bg-surface/70 p-6 backdrop-blur-xl">
              <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
                In the room
              </div>
              <div className="flex flex-col gap-2">
                {state.players.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...pop, delay: stagger(i, 0.07) }}
                    className="flex items-center gap-3"
                  >
                    <div className="grid size-9 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink ring-1 ring-line-bright">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm text-ink">{p.name}</span>
                    {i === 0 && (
                      <span className="font-mono text-[10px] tracking-widest text-acid uppercase">
                        you
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.button
              type="button"
              onClick={() => {
                haptic("tap");
                room.start();
              }}
              whileTap={{ scale: 0.97 }}
              transition={snap}
              className="w-full rounded-pill bg-acid py-4 text-base font-semibold text-void"
            >
              Start round 1
            </motion.button>
          </motion.div>
        )}

        {/* ---------------- RECORDING ---------------- */}
        {state.phase === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={snap}
            className="flex flex-1 flex-col justify-between gap-7"
          >
            <PromptCard
              prompt={state.prompt ?? ""}
              round={state.round}
              totalRounds={5}
            />

            <div className="flex flex-col items-center gap-6">
              {!sent ? (
                <>
                  <RecordButton
                    state={rec.state}
                    amplitude={rec.amplitude}
                    progress={rec.progress}
                    elapsedMs={rec.elapsedMs}
                    maxDurationMs={rec.maxDurationMs}
                    onStart={rec.start}
                    onStop={rec.stop}
                  />
                  {rec.state === "complete" && rec.recording && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={pop}
                      className="flex w-full gap-3"
                    >
                      <button
                        onClick={() => rec.reset()}
                        className="flex-1 rounded-pill border border-line-bright bg-surface py-4 text-base font-semibold text-ink-dim"
                      >
                        Retake
                      </button>
                      <button
                        onClick={send}
                        className="flex-1 rounded-pill bg-acid py-4 text-base font-semibold text-void"
                      >
                        Send it
                      </button>
                    </motion.div>
                  )}
                </>
              ) : (
                <WaitingOnOthers state={state} />
              )}
            </div>
          </motion.div>
        )}

        {/* ---------------- VOTING ---------------- */}
        {state.phase === "voting" && (
          <motion.div
            key="voting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={snap}
            className="flex-1 pt-2"
          >
            <VoteList
              submissions={state.submissions}
              players={state.players}
              myId={room.playerId}
              votedFor={room.myVote}
              onVote={room.vote}
            />
          </motion.div>
        )}

        {/* ---------------- REVEAL ---------------- */}
        {state.phase === "reveal" && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={snap}
            className="flex-1 pt-2"
          >
            <RevealStage
              submissions={state.submissions}
              players={state.players}
              winners={state.winners}
              myId={room.playerId}
              prompt={state.prompt}
              onNext={nextRound}
              onShare={winnerSub ? () => setShareOpen(true) : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareOpen && winnerSub && (
          <ShareSheet
            data={{
              prompt: state.prompt ?? "",
              authorName: winnerName,
              votes: winnerSub.votes ?? 0,
              peaks: winnerSub.peaks,
              dailyNumber: state.round === 1 ? dailyNumber() : undefined,
              handle: "aux",
            }}
            audioUrl={winnerAudio}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function WaitingOnOthers({ state }: { state: { players: { id: string; name: string; submitted: boolean }[] } }) {
  const waiting = state.players.filter((p) => !p.submitted);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={pop}
      className="w-full rounded-card border border-line bg-surface/70 p-6 text-center backdrop-blur-xl"
    >
      <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
        Sent · waiting on the group
      </div>
      <div className="opacity-40">
        <WaveformPulse bars={26} />
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {state.players.map((p) => (
          <span
            key={p.id}
            className={cn(
              "rounded-pill border px-3 py-1.5 text-xs transition-colors",
              p.submitted
                ? "border-acid/50 bg-acid/10 text-acid"
                : "border-line bg-transparent text-ink-faint",
            )}
          >
            {p.name} {p.submitted ? "✓" : "…"}
          </span>
        ))}
      </div>
      {waiting.length > 0 && (
        <p className="mt-4 text-xs text-ink-faint">
          Reveal unlocks when everyone&apos;s in
        </p>
      )}
    </motion.div>
  );
}

function Header({ state }: { state: { code: string; round: number; phase: string; players: unknown[] } }) {
  const label: Record<string, string> = {
    lobby: "Lobby",
    recording: "Recording",
    voting: "Voting",
    reveal: "Reveal",
  };
  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-baseline gap-2">
        <span className="display text-2xl text-acid text-glow-acid">aux</span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">
          demo
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-pill border border-line bg-surface/60 px-3 py-1.5 backdrop-blur">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-acid" />
        </span>
        <span className="font-mono text-[11px] tracking-widest text-ink-dim">
          {label[state.phase] ?? state.phase}
          {state.round > 0 ? ` · R${state.round}` : ""}
        </span>
      </div>
    </header>
  );
}

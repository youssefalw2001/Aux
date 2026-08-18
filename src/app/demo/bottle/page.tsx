"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnonReveal } from "@/components/AnonReveal";
import { BottleSpin } from "@/components/BottleSpin";
import { PromptCard } from "@/components/PromptCard";
import { RecordButton } from "@/components/RecordButton";
import { ShareSheet } from "@/components/ShareSheet";
import { WaveformPulse } from "@/components/Waveform";
import { useRecorder } from "@/lib/audio/useRecorder";
import { haptic } from "@/lib/haptics";
import { pop, snap, stagger } from "@/lib/motion";
import type { PlayerView, SubmissionView } from "@/lib/room/protocol";
import { bottlePrompt } from "@/lib/prompts";
import { cn } from "@/lib/utils";

/**
 * Spin the Bottle.
 *
 * Flow: spin → the bottle lands on someone IN the room → everyone records an
 * anonymous voice note about them → they hear all of it without knowing who
 * said what → authorship reveal is a separate, deliberate tap.
 *
 * The bottle never points outside the room. Everyone in the circle joined, so
 * being picked is consented to by construction, and the payoff lands in the app
 * rather than as an obligation aimed at somebody who isn't playing.
 */

const MAX_MS = 20_000;
const ME = "you-local";

const BOTS = [
  { id: "bot-maya", name: "Maya" },
  { id: "bot-dre", name: "Dre" },
  { id: "bot-priya", name: "Priya" },
  { id: "bot-tia", name: "Tia" },
] as const;

type Phase = "lobby" | "spinning" | "recording" | "waiting" | "reveal";

function fakePeaks(seed: number, n = 40): number[] {
  let h = seed * 2654435761;
  return Array.from({ length: n }, (_, i) => {
    h = (h ^ (h << 13)) >>> 0;
    h = (h ^ (h >>> 17)) >>> 0;
    const noise = ((h % 1000) / 1000) * 0.7 + 0.3;
    const env = Math.sin((i / n) * Math.PI) * 0.6 + 0.4;
    return Math.max(0.1, Math.min(1, noise * env));
  });
}

export default function BottlePage() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <NameGate name={name} setName={setName} onJoin={() => setJoined(true)} />
    );
  }
  return <BottleRoom myName={name} />;
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
          <Link href="/" className="display text-4xl text-acid text-glow-acid">
            aux
          </Link>
          <h1 className="display mt-4 text-3xl text-ink">Spin the Bottle</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-dim">
            The bottle picks someone in the room. Everyone records an anonymous
            voice note about them. Then they hear all of it.
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface/70 p-6 backdrop-blur-xl">
          <div className="opacity-50">
            <WaveformPulse bars={28} />
          </div>
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
            className="glow-acid w-full rounded-pill bg-acid py-4 text-base font-bold text-void disabled:opacity-30"
          >
            Join the circle
          </motion.button>
          <p className="text-center text-[11px] tracking-wider text-ink-faint uppercase">
            Simulated players · nothing uploaded
          </p>
        </div>
      </motion.div>
    </main>
  );
}

function BottleRoom({ myName }: { myName: string }) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [lastSubject, setLastSubject] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [subs, setSubs] = useState<SubmissionView[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [round, setRound] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const players: PlayerView[] = [
    { id: ME, name: myName || "You", connected: true, submitted: false, voted: false },
    ...BOTS.map((b) => ({
      id: b.id,
      name: b.name,
      connected: true,
      submitted: false,
      voted: false,
    })),
  ];

  const rec = useRecorder({
    maxDurationMs: MAX_MS,
    onComplete: () => haptic("success"),
  });

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const subjectName =
    players.find((p) => p.id === subjectId)?.name ?? "someone";

  const onLanded = (id: string) => {
    setSubjectId(id);
    setPrompt(bottlePrompt(players.find((p) => p.id === id)?.name ?? "them").text);
    later(() => setPhase("recording"), 700);
  };

  const send = () => {
    if (!rec.recording) return;
    haptic("success");

    // The subject doesn't record about themselves
    const speakers = players.filter((p) => p.id !== subjectId);
    const mine: SubmissionView = {
      playerId: ME,
      clipUrl: rec.recording.url,
      peaks: rec.recording.peaks,
      durationMs: rec.recording.durationMs,
    };
    setSubs(subjectId === ME ? [] : [mine]);
    setPhase("waiting");

    const bots = speakers.filter((p) => p.id !== ME);
    bots.forEach((bot, i) => {
      later(
        () => {
          setSubs((prev) => [
            ...prev,
            {
              playerId: bot.id,
              clipUrl: "",
              peaks: fakePeaks(i + 2),
              durationMs: 4200 + i * 2300,
            },
          ]);
          if (i === bots.length - 1) later(() => setPhase("reveal"), 650);
        },
        800 + i * 900 + Math.random() * 500,
      );
    });
  };

  const nextRound = () => {
    clearTimers();
    rec.reset();
    setShareOpen(false);
    setLastSubject(subjectId);
    setSubjectId(null);
    setPrompt(null);
    setSubs([]);
    setPhase("spinning");
  };

  const startGame = () => {
    haptic("tap");
    setRound(1);
    setPhase("spinning");
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-12">
      <Header phase={phase} round={round} />

      <AnimatePresence mode="wait">
        {phase === "lobby" && (
          <Stage key="lobby">
            <div className="rounded-card border border-line bg-surface/70 p-6 backdrop-blur-xl">
              <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
                In the circle
              </div>
              <div className="flex flex-col gap-2">
                {players.map((p, i) => (
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
              onClick={startGame}
              whileTap={{ scale: 0.97 }}
              transition={snap}
              className="glow-acid w-full rounded-pill bg-acid py-4 text-base font-bold text-void"
            >
              Spin the bottle
            </motion.button>
          </Stage>
        )}

        {phase === "spinning" && (
          <Stage key="spinning" center>
            <BottleSpin
              players={players}
              excludeId={lastSubject}
              onLanded={onLanded}
              autoStart
            />
          </Stage>
        )}

        {phase === "recording" && (
          // Centred, not space-between: on a tall viewport `justify-between`
          // strands the prompt at the top and the button at the bottom with a
          // dead void between them.
          <Stage key="recording" center>
            <PromptCard prompt={prompt ?? ""} round={round} />
            {subjectId === ME ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={pop}
                className="rounded-card border border-line bg-surface/70 p-7 text-center backdrop-blur-xl"
              >
                <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
                  It landed on you
                </div>
                <div className="opacity-40">
                  <WaveformPulse bars={24} />
                </div>
                <p className="mt-5 text-sm text-ink-dim">
                  Everyone else is recording something about you. Sit tight.
                </p>
                <button
                  onClick={send}
                  className="mt-5 rounded-pill bg-acid px-8 py-3 text-sm font-semibold text-void"
                >
                  Let them cook
                </button>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-6">
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
                      className="flex-1 rounded-pill bg-acid py-4 text-base font-bold text-void"
                    >
                      Send it
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </Stage>
        )}

        {phase === "waiting" && (
          <Stage key="waiting" center>
            <div className="w-full rounded-card border border-line bg-surface/70 p-7 text-center backdrop-blur-xl">
              <div className="mb-4 font-mono text-[11px] tracking-[0.2em] text-acid uppercase">
                Sent · waiting on the circle
              </div>
              <div className="opacity-40">
                <WaveformPulse bars={26} />
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {players
                  .filter((p) => p.id !== subjectId)
                  .map((p) => {
                    const done = subs.some((s) => s.playerId === p.id);
                    return (
                      <span
                        key={p.id}
                        className={cn(
                          "rounded-pill border px-3 py-1.5 text-xs transition-colors",
                          done
                            ? "border-acid/50 bg-acid/10 text-acid"
                            : "border-line text-ink-faint",
                        )}
                      >
                        {p.name} {done ? "✓" : "…"}
                      </span>
                    );
                  })}
              </div>
            </div>
          </Stage>
        )}

        {phase === "reveal" && subjectId && (
          <Stage key="reveal">
            <AnonReveal
              subjectName={subjectName}
              subjectId={subjectId}
              submissions={subs}
              players={players}
              myId={ME}
              prompt={prompt}
              onNext={nextRound}
              onShare={subs.length ? () => setShareOpen(true) : undefined}
            />
          </Stage>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareOpen && subs.length > 0 && (
          <ShareSheet
            data={{
              prompt: prompt ?? "",
              authorName: subjectName,
              votes: subs.length,
              peaks: subs[0].peaks,
              handle: "aux",
            }}
            audioUrl={subs.find((s) => s.playerId === ME)?.clipUrl ?? null}
            initialCaption={`what the group actually said about ${subjectName}`}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function Stage({
  children,
  center,
}: {
  children: React.ReactNode;
  center?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={snap}
      className={cn(
        "flex flex-1 flex-col",
        center ? "justify-center gap-10" : "justify-between gap-7",
      )}
    >
      {children}
    </motion.div>
  );
}

function Header({ phase, round }: { phase: Phase; round: number }) {
  const label: Record<Phase, string> = {
    lobby: "Circle",
    spinning: "Spinning",
    recording: "Recording",
    waiting: "Waiting",
    reveal: "Reveal",
  };
  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-baseline gap-2">
        <Link href="/" className="display text-2xl text-acid text-glow-acid">
          aux
        </Link>
        <span className="font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">
          bottle
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-pill border border-line bg-surface/60 px-3 py-1.5 backdrop-blur">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-acid" />
        </span>
        <span className="font-mono text-[11px] tracking-widest text-ink-dim">
          {label[phase]}
          {round > 0 ? ` · R${round}` : ""}
        </span>
      </div>
    </header>
  );
}

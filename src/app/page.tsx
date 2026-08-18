"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ClipPlayer } from "@/components/ClipPlayer";
import { PromptCard } from "@/components/PromptCard";
import { RecordButton } from "@/components/RecordButton";
import { useRecorder } from "@/lib/audio/useRecorder";
import { haptic } from "@/lib/haptics";
import { pop, snap } from "@/lib/motion";
import { randomPrompt, type Prompt } from "@/lib/prompts";

const MAX_MS = 30_000;

export default function RoundScreen() {
  const [prompt, setPrompt] = useState<Prompt>(() => randomPrompt());
  const [submitted, setSubmitted] = useState(false);

  const rec = useRecorder({
    maxDurationMs: MAX_MS,
    onComplete: () => haptic("success"),
  });

  const nextPrompt = () => {
    haptic("tick");
    rec.reset();
    setSubmitted(false);
    setPrompt(randomPrompt([prompt.id]));
  };

  const submit = () => {
    haptic("success");
    setSubmitted(true);
    // TODO: upload to R2 + notify the Durable Object room
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10">
      <Header />

      <div className="flex flex-1 flex-col justify-between gap-8">
        <PromptCard prompt={prompt.text} round={1} totalRounds={5} />

        <div className="flex flex-col items-center gap-8">
          <AnimatePresence mode="wait" initial={false}>
            {rec.recording && rec.state === "complete" ? (
              <motion.div
                key="playback"
                className="flex w-full flex-col gap-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={snap}
              >
                <ClipPlayer
                  url={rec.recording.url}
                  peaks={rec.recording.peaks}
                  durationMs={rec.recording.durationMs}
                  label={submitted ? "Submitted — waiting on the group" : "Your take"}
                  tone={submitted ? "cyan" : "acid"}
                />

                {!submitted ? (
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => rec.reset()}>
                      Retake
                    </Button>
                    <Button variant="primary" onClick={submit}>
                      Send it
                    </Button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={pop}
                    className="text-center"
                  >
                    <p className="text-sm text-ink-dim">
                      Reveal unlocks when everyone&apos;s in.
                    </p>
                    <button
                      onClick={nextPrompt}
                      className="mt-3 font-mono text-[11px] tracking-[0.2em] text-acid uppercase"
                    >
                      New prompt →
                    </button>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="record"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={snap}
              >
                <RecordButton
                  state={rec.state}
                  amplitude={rec.amplitude}
                  progress={rec.progress}
                  elapsedMs={rec.elapsedMs}
                  maxDurationMs={rec.maxDurationMs}
                  onStart={rec.start}
                  onStop={rec.stop}
                  mode="toggle"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between py-6">
      <div className="display text-2xl tracking-tight text-acid text-glow-acid">
        aux
      </div>
      <div className="flex items-center gap-2 rounded-pill border border-line bg-surface/60 px-3 py-1.5 backdrop-blur">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-acid opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-acid" />
        </span>
        <span className="font-mono text-[11px] tracking-widest text-ink-dim">
          4 IN ROOM
        </span>
      </div>
    </header>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={snap}
      className={
        variant === "primary"
          ? "flex-1 rounded-pill bg-acid py-4 text-base font-semibold text-void outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
          : "flex-1 rounded-pill border border-line-bright bg-surface py-4 text-base font-semibold text-ink-dim outline-none focus-visible:ring-4 focus-visible:ring-acid/20"
      }
    >
      {children}
    </motion.button>
  );
}

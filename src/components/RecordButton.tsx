"use client";

import { motion, useTransform, type MotionValue } from "motion/react";
import { useState } from "react";
import { haptic } from "@/lib/haptics";
import { pop, tap as tapSpring } from "@/lib/motion";
import { cn, formatDuration } from "@/lib/utils";
import type { RecorderState } from "@/lib/audio/useRecorder";

/**
 * The most-touched element in the app.
 *
 * Everything here is driven by MotionValues rather than React state, so the
 * amplitude rings track the microphone at full frame rate without re-rendering
 * the component. The ring literally breathes with the user's voice — that
 * feedback loop is what makes recording feel good rather than clinical.
 */

interface Props {
  state: RecorderState;
  /** Spring-smoothed mic amplitude, 0..1. */
  amplitude: MotionValue<number>;
  /** Elapsed fraction, 0..1. */
  progress: MotionValue<number>;
  elapsedMs: number;
  maxDurationMs: number;
  onStart: () => void;
  onStop: () => void;
  /** "toggle" = tap to start/stop. "hold" = press and hold. */
  mode?: "toggle" | "hold";
}

const SIZE = 168; // button diameter
const ARC = 196; // progress ring diameter

export function RecordButton({
  state,
  amplitude,
  progress,
  elapsedMs,
  maxDurationMs,
  onStart,
  onStop,
  mode = "toggle",
}: Props) {
  const [pressed, setPressed] = useState(false);
  const recording = state === "recording";
  const busy = state === "requesting" || state === "stopping";

  // --- Amplitude-driven geometry. Three rings at different gains so loud
  // --- input pushes the outer rings much further, giving a sense of depth.
  const ring1 = useTransform(amplitude, [0, 1], [1, 1.16]);
  const ring2 = useTransform(amplitude, [0, 1], [1, 1.34]);
  const ring3 = useTransform(amplitude, [0, 1], [1, 1.58]);
  const ring1Opacity = useTransform(amplitude, [0, 0.15, 1], [0.35, 0.5, 0.9]);
  const ring2Opacity = useTransform(amplitude, [0, 1], [0.18, 0.55]);
  const ring3Opacity = useTransform(amplitude, [0, 1], [0.06, 0.3]);

  // Bloom behind everything — this is what reads as "glow" on a phone at night
  const bloomScale = useTransform(amplitude, [0, 1], [0.9, 1.45]);
  const bloomOpacity = useTransform(amplitude, [0, 1], [0.25, 0.75]);

  // The inner disc swells very slightly. Subtle on purpose: too much and it
  // feels like a bouncing toy instead of a live instrument.
  const coreScale = useTransform(amplitude, [0, 1], [1, 1.045]);

  const trigger = () => {
    if (busy) return;
    if (recording) {
      haptic("thud");
      onStop();
    } else {
      haptic("tap");
      onStart();
    }
  };

  const holdHandlers =
    mode === "hold"
      ? {
          onPointerDown: () => {
            setPressed(true);
            if (!recording && !busy) {
              haptic("tap");
              onStart();
            }
          },
          onPointerUp: () => {
            setPressed(false);
            if (recording) {
              haptic("thud");
              onStop();
            }
          },
          onPointerCancel: () => {
            setPressed(false);
            if (recording) onStop();
          },
          onPointerLeave: () => {
            if (pressed && recording) {
              setPressed(false);
              onStop();
            }
          },
        }
      : {
          onPointerDown: () => setPressed(true),
          onPointerUp: () => setPressed(false),
          onPointerCancel: () => setPressed(false),
          onPointerLeave: () => setPressed(false),
          onClick: trigger,
        };

  const remaining = Math.max(0, maxDurationMs - elapsedMs);
  const nearlyOut = remaining < 5000 && recording;

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="relative grid place-items-center"
        style={{ width: ARC + 40, height: ARC + 40 }}
      >
        {/* --- Bloom --- */}
        <motion.div
          aria-hidden
          className={cn(
            "absolute rounded-full blur-3xl",
            nearlyOut ? "bg-hot" : "bg-acid",
          )}
          style={{
            width: SIZE,
            height: SIZE,
            scale: recording ? bloomScale : 0.85,
            opacity: recording ? bloomOpacity : 0.14,
          }}
        />

        {/* --- Amplitude rings --- */}
        {(
          [
            [ring3, ring3Opacity, 1],
            [ring2, ring2Opacity, 1],
            [ring1, ring1Opacity, 1.5],
          ] as const
        ).map(([scale, opacity, width], i) => (
          <motion.div
            key={i}
            aria-hidden
            className={cn(
              "absolute rounded-full border",
              nearlyOut ? "border-hot" : "border-acid",
            )}
            style={{
              width: SIZE,
              height: SIZE,
              borderWidth: width,
              scale: recording ? scale : 1,
              opacity: recording ? opacity : 0,
            }}
            transition={tapSpring}
          />
        ))}

        {/* --- Progress arc. pathLength is driven by a MotionValue, so this
                updates every frame without touching React. --- */}
        <svg
          aria-hidden
          className="absolute -rotate-90"
          width={ARC}
          height={ARC}
          viewBox={`0 0 ${ARC} ${ARC}`}
          fill="none"
        >
          <circle
            cx={ARC / 2}
            cy={ARC / 2}
            r={ARC / 2 - 3}
            stroke="currentColor"
            className="text-line"
            strokeWidth={2}
            opacity={recording ? 1 : 0}
          />
          <motion.circle
            cx={ARC / 2}
            cy={ARC / 2}
            r={ARC / 2 - 3}
            stroke="currentColor"
            className={nearlyOut ? "text-hot" : "text-acid"}
            strokeWidth={3}
            strokeLinecap="round"
            style={{ pathLength: progress, opacity: recording ? 1 : 0 }}
          />
        </svg>

        {/* --- The button --- */}
        <motion.button
          type="button"
          aria-label={recording ? "Stop recording" : "Start recording"}
          aria-pressed={recording}
          disabled={state === "unsupported" || state === "denied"}
          {...holdHandlers}
          animate={{ scale: pressed ? 0.93 : 1 }}
          transition={tapSpring}
          className={cn(
            "relative grid place-items-center rounded-full",
            "outline-none transition-colors duration-200",
            "focus-visible:ring-4 focus-visible:ring-acid/40",
            "disabled:opacity-40",
            recording
              ? nearlyOut
                ? "bg-hot text-void"
                : "bg-acid text-void"
              : "bg-surface-2 text-acid ring-1 ring-line-bright",
          )}
          style={{ width: SIZE, height: SIZE }}
        >
          {/* Inner disc swell */}
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ scale: recording ? coreScale : 1 }}
          />

          <motion.span
            key={recording ? "stop" : "mic"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={pop}
            className="relative"
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </motion.span>
        </motion.button>
      </div>

      {/* --- Timer / status line --- */}
      <div className="h-12 text-center">
        {recording ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={pop}
          >
            <div
              className={cn(
                "font-mono text-3xl tabular-nums",
                nearlyOut ? "text-hot" : "text-ink",
              )}
            >
              {formatDuration(elapsedMs)}
            </div>
            <div className="mt-1 text-xs tracking-widest text-ink-faint uppercase">
              {nearlyOut
                ? `${Math.ceil(remaining / 1000)}s left`
                : mode === "hold"
                  ? "Release to send"
                  : "Tap to finish"}
            </div>
          </motion.div>
        ) : (
          <StatusLine state={state} mode={mode} />
        )}
      </div>
    </div>
  );
}

function StatusLine({
  state,
  mode,
}: {
  state: RecorderState;
  mode: "toggle" | "hold";
}) {
  const copy: Record<RecorderState, string> = {
    idle: mode === "hold" ? "Hold to record" : "Tap to record",
    requesting: "Waiting for mic…",
    recording: "",
    stopping: "Wrapping up…",
    complete: "Got it",
    denied: "Mic blocked — check browser settings",
    unsupported: "Recording isn't supported in this browser",
    error: "Something went wrong. Try again?",
  };

  const isProblem =
    state === "denied" || state === "unsupported" || state === "error";

  return (
    <motion.p
      key={state}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={pop}
      className={cn(
        "px-6 text-sm tracking-widest uppercase",
        isProblem ? "text-hot" : "text-ink-faint",
      )}
    >
      {copy[state]}
    </motion.p>
  );
}

function MicIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5.5a4 4 0 0 0 4 4Z"
        fill="currentColor"
      />
      <path
        d="M19 11.5a7 7 0 0 1-14 0M12 18.5V22"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
    </svg>
  );
}

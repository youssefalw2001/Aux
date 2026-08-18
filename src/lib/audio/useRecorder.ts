"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMotionValue, useSpring, type MotionValue } from "motion/react";
import { amplitudeSpring } from "@/lib/motion";
import { clamp } from "@/lib/utils";
import {
  isRecordingSupported,
  pickRecordingFormat,
  type RecordingFormat,
} from "./mime";

export type RecorderState =
  | "unsupported"
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "complete"
  | "denied"
  | "error";

export interface Recording {
  blob: Blob;
  url: string;
  durationMs: number;
  /** Normalised 0..1 peaks sampled across the clip, for waveform rendering. */
  peaks: number[];
  format: RecordingFormat;
}

interface Options {
  /** Hard cap. Round timers should stop us well before this. */
  maxDurationMs?: number;
  /** How many peaks to capture for the waveform. */
  peakCount?: number;
  onComplete?: (r: Recording) => void;
}

const noopSubscribe = () => () => {};

/**
 * Records a voice note and exposes live amplitude as a MotionValue.
 *
 * The amplitude value is deliberately NOT React state — it updates every
 * frame, and putting that through React would cause 60 re-renders/sec. As a
 * MotionValue it drives animation directly off the native pipeline.
 */
export function useRecorder({
  maxDurationMs = 30_000,
  peakCount = 56,
  onComplete,
}: Options = {}) {
  /**
   * Capability detection via useSyncExternalStore rather than an effect:
   * it's SSR-safe (server snapshot returns true), needs no setState-in-effect,
   * and avoids a hydration mismatch on the status copy.
   */
  const supported = useSyncExternalStore(
    noopSubscribe,
    isRecordingSupported,
    () => true,
  );

  const [rawState, setState] = useState<RecorderState>("idle");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const state: RecorderState = supported ? rawState : "unsupported";

  /** Raw per-frame RMS. Consumers usually want `amplitude` instead. */
  const amplitudeRaw = useMotionValue(0);
  /** Spring-smoothed amplitude, 0..1. This is what the ring should bind to. */
  const amplitude: MotionValue<number> = useSpring(
    amplitudeRaw,
    amplitudeSpring,
  );
  /**
   * Elapsed fraction 0..1, updated every frame. Bind rings/meters to this.
   * `elapsedMs` React state is throttled to ~10Hz for the text timer only —
   * driving text off every frame would re-render the tree 60x/sec.
   */
  const progress = useMotionValue(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const peaksRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const lastPeakAtRef = useRef(0);
  const lastTenthRef = useRef(-1);
  // Explicit ArrayBuffer generic: lib.dom's getByteTimeDomainData rejects
  // Uint8Array<ArrayBufferLike> because it could be SharedArrayBuffer-backed.
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Latest onComplete without making every callback depend on it
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const teardown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    // Closing the context releases the mic indicator on iOS
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      void ctxRef.current.close();
    }
    ctxRef.current = null;
    recorderRef.current = null;
    amplitudeRaw.set(0);
  }, [amplitudeRaw]);

  useEffect(() => teardown, [teardown]);

  /**
   * Declared before `tick` so the auto-stop path can call it directly without
   * a forward reference (which breaks both TDZ analysis and memoization).
   */
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setState("stopping");
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    amplitudeRaw.set(0);
    recorder.stop(); // fires onstop → builds the Blob
  }, [amplitudeRaw]);

  const start = useCallback(async () => {
    if (rawState === "recording" || rawState === "requesting") return;
    if (!isRecordingSupported()) return;

    setState("requesting");
    setRecording(null);
    chunksRef.current = [];
    peaksRef.current = [];
    lastTenthRef.current = -1;
    progress.set(0);
    setElapsedMs(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // --- Analyser for the live amplitude ring ---
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      // iOS starts contexts suspended even inside a gesture handler
      if (ctx.state === "suspended") await ctx.resume();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      // --- Recorder, with negotiated MIME type ---
      const format = pickRecordingFormat();
      const recorder = new MediaRecorder(
        stream,
        format.mimeType ? { mimeType: format.mimeType } : undefined,
      );

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const type = format.mimeType || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const result: Recording = {
          blob,
          url: URL.createObjectURL(blob),
          durationMs: performance.now() - startedAtRef.current,
          peaks: peaksRef.current.slice(),
          format,
        };
        setRecording(result);
        setState("complete");
        onCompleteRef.current?.(result);
        teardown();
      };

      recorder.onerror = () => {
        setState("error");
        teardown();
      };

      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      lastPeakAtRef.current = startedAtRef.current;
      recorder.start(250); // timeslice keeps chunks flowing for long clips
      setState("recording");

      /**
       * Per-frame loop: compute RMS, drive the MotionValues, sample peaks.
       * Defined locally so it can schedule itself without a forward reference,
       * and so it closes directly over `analyser` rather than re-reading refs.
       */
      const loop = () => {
        // Reuse one buffer — allocating 1KB per frame at 60fps is 60KB/s of
        // garbage and shows up as jank on low-end Android.
        let buf = bufRef.current;
        if (!buf || buf.length !== analyser.fftSize) {
          buf = new Uint8Array(analyser.fftSize);
          bufRef.current = buf;
        }
        analyser.getByteTimeDomainData(buf);

        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);

        // Speech RMS sits around 0.04–0.2. Scale into a usable 0..1 with a
        // gentle curve so quiet speech still moves the ring visibly.
        const scaled = clamp(Math.pow(rms * 5.2, 0.75), 0, 1);
        amplitudeRaw.set(scaled);

        const now = performance.now();
        const elapsed = now - startedAtRef.current;

        // Smooth: every frame, no React involved.
        progress.set(clamp(elapsed / maxDurationMs, 0, 1));

        // Throttled: only when the displayed tenth-of-a-second changes.
        const tenth = Math.floor(elapsed / 100);
        if (tenth !== lastTenthRef.current) {
          lastTenthRef.current = tenth;
          setElapsedMs(elapsed);
        }

        // Sample peaks on a fixed cadence so the waveform is evenly spaced
        const peakInterval = maxDurationMs / peakCount;
        if (now - lastPeakAtRef.current >= peakInterval) {
          peaksRef.current.push(scaled);
          lastPeakAtRef.current = now;
        }

        if (elapsed >= maxDurationMs) {
          stop();
          return;
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      const name = (err as DOMException)?.name;
      setState(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : "error",
      );
      teardown();
    }
  }, [
    rawState,
    teardown,
    progress,
    amplitudeRaw,
    maxDurationMs,
    peakCount,
    stop,
  ]);

  const reset = useCallback(() => {
    setRecording((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setElapsedMs(0);
    progress.set(0);
    lastTenthRef.current = -1;
    peaksRef.current = [];
    chunksRef.current = [];
    setState("idle");
  }, [progress]);

  return {
    state,
    /** Throttled to ~10Hz. For text display only. */
    elapsedMs,
    recording,
    /** Spring-smoothed mic amplitude, 0..1. Bind visuals to this. */
    amplitude,
    /** Unsmoothed RMS, 0..1. For meters that should feel immediate. */
    amplitudeRaw,
    /** Elapsed fraction 0..1 as a MotionValue, updated every frame. */
    progress,
    maxDurationMs,
    supported,
    start,
    stop,
    reset,
    isRecording: state === "recording",
  };
}

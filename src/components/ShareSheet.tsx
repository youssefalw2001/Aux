"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { pop, snap, tap } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  CARD_H,
  CARD_W,
  renderShareCard,
  renderShareCardPng,
  type ShareCardData,
} from "@/lib/share/renderShareCard";
import {
  exportShareVideo,
  isVideoExportSupported,
  shareOrDownload,
} from "@/lib/share/exportVideo";

/**
 * The share step. Turns a round into a postable artifact.
 *
 * Caption first, preview always visible. The caption is the payload — it's what
 * makes the clip legible with the sound off — so it gets the input focus and
 * the largest type on the card.
 */

interface Props {
  data: Omit<ShareCardData, "caption">;
  audioUrl: string | null;
  onClose: () => void;
  /** Pre-filled if the group already voted on a caption. */
  initialCaption?: string;
}

type Stage = "compose" | "rendering" | "ready";

export function ShareSheet({ data, audioUrl, onClose, initialCaption }: Props) {
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [stage, setStage] = useState<Stage>("compose");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const videoOk = typeof window !== "undefined" && isVideoExportSupported();
  const full: ShareCardData = { ...data, caption };

  /** Keep the on-screen preview in sync with the caption as it's typed. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderShareCard(ctx, { ...data, caption }, 0.62);
  }, [data, caption]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      if (alive) paint();
    };
    void run();
    return () => {
      alive = false;
    };
  }, [paint]);

  const makeVideo = async () => {
    if (!audioUrl) return;
    haptic("tap");
    setStage("rendering");
    setProgress(0);
    setError(null);
    try {
      const out = await exportShareVideo(full, audioUrl, setProgress);
      setResult({ url: out.url, blob: out.blob, ext: out.format.extension });
      setStage("ready");
      haptic("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
      setStage("compose");
      haptic("error");
    }
  };

  const makeImage = async () => {
    haptic("tap");
    setStage("rendering");
    setError(null);
    try {
      const blob = await renderShareCardPng(full);
      setResult({ url: URL.createObjectURL(blob), blob, ext: "png" });
      setStage("ready");
      haptic("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
      setStage("compose");
    }
  };

  const share = async () => {
    if (!result) return;
    haptic("tap");
    await shareOrDownload(
      result.blob,
      `aux-${data.authorName.toLowerCase()}.${result.ext}`,
      data.prompt,
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-pit/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="font-mono text-[11px] tracking-[0.24em] text-acid uppercase">
            Make it postable
          </div>
          <button
            onClick={onClose}
            className="rounded-pill border border-line px-4 py-2 text-xs text-ink-dim"
          >
            Close
          </button>
        </div>

        {/* ---------- preview ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={pop}
          className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-line"
        >
          {stage === "ready" && result?.ext !== "png" ? (
            <video
              src={result?.url}
              controls
              playsInline
              className="block h-auto w-full"
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={CARD_W}
              height={CARD_H}
              className="block h-auto w-full"
            />
          )}
        </motion.div>

        {/* ---------- caption ---------- */}
        {stage === "compose" && (
          <div className="mt-6 flex flex-col gap-3">
            <label className="font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">
              Caption — this is the part people read
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 110))}
              placeholder="he really said that out loud"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-card border border-line-bright bg-surface px-5 py-4 text-base text-ink placeholder:text-ink-faint focus:border-acid focus:outline-none"
            />
            <div className="flex justify-between text-[11px] text-ink-faint">
              <span>Works with the sound off — that&apos;s the point</span>
              <span className="tabular-nums">{caption.length}/110</span>
            </div>
          </div>
        )}

        {/* ---------- progress ---------- */}
        {stage === "rendering" && (
          <div className="mt-6 text-center">
            <div className="font-mono text-sm text-acid tabular-nums">
              Rendering… {Math.round(progress * 100)}%
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
              <motion.div
                className="h-full bg-acid"
                animate={{ width: `${Math.max(4, progress * 100)}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Plays your clip through once to record it
            </p>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-center text-sm text-hot"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* ---------- actions ---------- */}
        <div className="mt-auto flex flex-col gap-3 pt-8">
          {stage === "compose" && (
            <>
              {videoOk && audioUrl && (
                <motion.button
                  type="button"
                  onClick={makeVideo}
                  whileTap={{ scale: 0.97 }}
                  transition={snap}
                  className="glow-acid w-full rounded-pill bg-acid py-4 text-base font-bold text-void"
                >
                  Make the video
                </motion.button>
              )}
              <motion.button
                type="button"
                onClick={makeImage}
                whileTap={{ scale: 0.97 }}
                transition={snap}
                className={cn(
                  "w-full rounded-pill py-4 text-base font-semibold",
                  videoOk && audioUrl
                    ? "border border-line-bright bg-surface text-ink-dim"
                    : "bg-acid text-void",
                )}
              >
                Just the image
              </motion.button>
              {!videoOk && (
                <p className="text-center text-[11px] text-ink-faint">
                  Video export isn&apos;t supported in this browser
                </p>
              )}
            </>
          )}

          {stage === "ready" && (
            <>
              <motion.button
                type="button"
                onClick={share}
                whileTap={{ scale: 0.97 }}
                transition={tap}
                className="glow-acid w-full rounded-pill bg-acid py-4 text-base font-bold text-void"
              >
                Share it
              </motion.button>
              <button
                onClick={() => {
                  setResult(null);
                  setStage("compose");
                }}
                className="w-full rounded-pill border border-line-bright bg-surface py-4 text-base font-semibold text-ink-dim"
              >
                Edit caption
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  CARD_H,
  CARD_W,
  renderShareCard,
  type ShareCardData,
} from "@/lib/share/renderShareCard";
import { dailyNumber } from "@/lib/daily";

/**
 * Design harness for the share card.
 *
 * The card is canvas-drawn, so it can't be inspected with devtools and it's
 * trivially easy to ship a broken layout — clipped text, overlapping blocks,
 * type that's illegible at thumbnail size. This route renders the real
 * renderer against the awkward cases (very long caption, very short caption,
 * long prompt) so regressions are visible immediately.
 */

const CASES: Array<{ label: string; data: ShareCardData }> = [
  {
    label: "typical",
    data: {
      prompt:
        "Leave a voicemail breaking up with someone over something extremely petty.",
      caption: "he really said that out loud",
      authorName: "Maya",
      votes: 3,
      peaks: Array.from({ length: 44 }, (_, i) =>
        Math.max(0.12, Math.abs(Math.sin(i * 0.7)) * (0.5 + (i % 5) / 10)),
      ),
      dailyNumber: dailyNumber(),
      handle: "aux",
    },
  },
  {
    label: "long caption + long prompt",
    data: {
      prompt:
        "Give a TED talk introduction for the single worst decision you made this entire year, with full confidence.",
      caption:
        "the way he opened with genuine conviction and then immediately lost the plot halfway through the sentence",
      authorName: "Christopher",
      votes: 11,
      peaks: Array.from({ length: 44 }, (_, i) => 0.2 + ((i * 7) % 9) / 12),
      dailyNumber: 142,
      handle: "aux",
    },
  },
  {
    label: "short caption, no daily",
    data: {
      prompt: "Say “I'm not drunk” like you are extremely drunk.",
      caption: "no notes",
      authorName: "Dre",
      votes: 1,
      peaks: Array.from({ length: 44 }, (_, i) => (i % 3 === 0 ? 0.9 : 0.25)),
      handle: "aux",
    },
  },
];

export default function CardHarness() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      setReady(true);
    };
    void run();
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="display mb-2 text-3xl text-acid">Share card harness</h1>
      <p className="mb-8 text-sm text-ink-dim">
        Real renderer, awkward inputs. Every card must stay legible at thumbnail
        size with the sound off.
      </p>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3" data-ready={ready}>
        {CASES.map((c) => (
          <figure key={c.label} className="flex flex-col gap-3">
            <Card data={c.data} />
            <figcaption className="font-mono text-[11px] tracking-widest text-ink-faint uppercase">
              {c.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

function Card({ data }: { data: ShareCardData }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const run = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderShareCard(ctx, data, 0.62);
    };
    void run();
  }, [data]);

  return (
    <canvas
      ref={ref}
      width={CARD_W}
      height={CARD_H}
      className="block h-auto w-full rounded-xl border border-line"
    />
  );
}

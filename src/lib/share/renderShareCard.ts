/**
 * Share card renderer — 1080×1920 canvas composition.
 *
 * This is the artifact the product actually lives or dies on. The game happens
 * between four people; THIS is the only thing a stranger ever sees, so it has
 * to be funny and legible on its own, with no context and no sound.
 *
 * Three constraints drive every decision here:
 *
 *  1. IT MUST WORK MUTED. Most social video is watched with sound off, so the
 *     caption is the payload and gets the most visual weight. A waveform alone
 *     communicates nothing.
 *  2. IT MUST READ AT THUMBNAIL SIZE. Type is huge, contrast is extreme.
 *  3. IT MUST CARRY THE BRAND IMPLICITLY. Acid-on-black plus the waveform motif
 *     is recognisable before the wordmark is read.
 *
 * Drawn frame-by-frame so the same code produces both a still PNG and the
 * video export (see exportVideo.ts).
 */

export const CARD_W = 1080;
export const CARD_H = 1920;

export interface ShareCardData {
  prompt: string;
  caption: string;
  authorName: string;
  votes: number;
  /** Normalised 0..1 amplitude samples. */
  peaks: number[];
  /** Optional daily puzzle number, e.g. 142. */
  dailyNumber?: number;
  handle?: string;
}

const ACID = "#c5f327";
const VOID = "#14161c";
const PIT = "#0e1014";
const INK = "#f5f6f7";
const DIM = "#8b8f9a";
const LINE = "#33363f";

/** Resolved once — canvas needs a real family name, not a CSS variable. */
function fontStack(weight: number, size: number, display = true): string {
  const family = display
    ? getComputedStyle(document.documentElement)
          .getPropertyValue("--font-bricolage")
          .trim() || "system-ui"
    : getComputedStyle(document.documentElement)
          .getPropertyValue("--font-geist-sans")
          .trim() || "system-ui";
  return `${weight} ${size}px ${family}, system-ui, sans-serif`;
}

/** Greedy word wrap. Returns the lines that fit within maxWidth. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  // Ellipsise if we ran out of room
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth - 40) {
      while (last.length > 4 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

/** Auto-size text down until it fits in the given number of lines. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
  weight = 800,
): { lines: string[]; size: number } {
  let size = startSize;
  for (; size > minSize; size -= 4) {
    ctx.font = fontStack(weight, size);
    const lines = wrap(ctx, text, maxWidth, maxLines + 1);
    if (lines.length <= maxLines) return { lines, size };
  }
  ctx.font = fontStack(weight, minSize);
  return { lines: wrap(ctx, text, maxWidth, maxLines), size: minSize };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * Draws one frame.
 * @param progress 0..1 playhead position — drives which waveform bars are lit.
 */
export function renderShareCard(
  ctx: CanvasRenderingContext2D,
  data: ShareCardData,
  progress = 1,
) {
  const { prompt, caption, authorName, votes, peaks, dailyNumber } = data;
  const handle = data.handle ?? "aux";
  const PAD = 88;
  const innerW = CARD_W - PAD * 2;

  /* ---------------- background ---------------- */
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Acid bloom, top-right
  const bloom = ctx.createRadialGradient(CARD_W - 60, 140, 0, CARD_W - 60, 140, 900);
  bloom.addColorStop(0, "rgba(197,243,39,0.22)");
  bloom.addColorStop(0.45, "rgba(197,243,39,0.07)");
  bloom.addColorStop(1, "rgba(197,243,39,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Counter-bloom, bottom-left, keeps the composition from feeling top-heavy
  const bloom2 = ctx.createRadialGradient(80, CARD_H - 200, 0, 80, CARD_H - 200, 700);
  bloom2.addColorStop(0, "rgba(197,243,39,0.10)");
  bloom2.addColorStop(1, "rgba(197,243,39,0)");
  ctx.fillStyle = bloom2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  /* ---------------- header ---------------- */
  ctx.textBaseline = "alphabetic";
  ctx.font = fontStack(800, 62);
  ctx.fillStyle = ACID;
  ctx.fillText("aux", PAD, 150);

  if (dailyNumber !== undefined) {
    ctx.font = fontStack(600, 30, false);
    const label = `DAILY #${dailyNumber}`;
    const w = ctx.measureText(label).width;
    roundRect(ctx, CARD_W - PAD - w - 44, 108, w + 44, 56, 28);
    ctx.strokeStyle = "#4a4e59";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = DIM;
    ctx.fillText(label, CARD_W - PAD - w - 22, 146);
  }

  /* ---------------- measure before drawing ----------------
     The caption and prompt both wrap to a variable number of lines, so a fixed
     layout leaves a large dead zone in the middle whenever either is short.
     Dead space reads as "unfinished" at thumbnail size, which is exactly the
     size that decides whether anyone stops scrolling. So: measure both blocks,
     then centre the caption + waveform group in the space that's left. */

  const promptFit = fitText(ctx, prompt, innerW, 4, 56, 34, 700);
  const promptH = promptFit.lines.length * promptFit.size * 1.18;

  const capFit = fitText(ctx, caption || prompt, innerW, 5, 132, 58, 800);
  const capH = capFit.lines.length * capFit.size * 1.02;

  const waveH = 240;
  const UNDERLINE_GAP = 34;
  const WAVE_GAP = 96;
  const groupH = capH + UNDERLINE_GAP + 8 + WAVE_GAP + waveH;

  const promptLabelY = 300;
  const promptTop = promptLabelY + 58;
  const contentTop = promptTop + promptH + 70;
  const footerTop = CARD_H - 330;
  const slack = Math.max(0, footerTop - contentTop - groupH);
  let y = contentTop + slack * 0.42; // slight upward bias — reads better

  /* ---------------- prompt (the setup) ---------------- */
  ctx.font = fontStack(600, 30, false);
  ctx.fillStyle = ACID;
  ctx.fillText("THE PROMPT", PAD, promptLabelY);

  ctx.font = fontStack(700, promptFit.size);
  ctx.fillStyle = DIM;
  let py = promptTop;
  for (const line of promptFit.lines) {
    ctx.fillText(line, PAD, py);
    py += promptFit.size * 1.18;
  }

  /* ---------------- caption (the payload) ----------------
     Biggest element on the card. This is the joke, and the only part that
     works with the sound off. */
  ctx.font = fontStack(800, capFit.size);
  ctx.fillStyle = INK;
  for (const line of capFit.lines) {
    ctx.fillText(line, PAD, y);
    y += capFit.size * 1.02;
  }

  // Acid underline anchoring the caption block
  ctx.strokeStyle = ACID;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(PAD, y + UNDERLINE_GAP);
  ctx.lineTo(PAD + Math.min(innerW, 260), y + UNDERLINE_GAP);
  ctx.stroke();
  y += UNDERLINE_GAP + 8;

  /* ---------------- waveform ---------------- */
  const waveY = y + WAVE_GAP;
  const bars = peaks.length ? peaks : Array.from({ length: 48 }, () => 0.4);
  const gap = 8;

  // Reserve room for a play glyph — a static card needs to signal "there's
  // audio here", otherwise the waveform is just decoration.
  const glyphW = 96;
  const waveW = innerW - glyphW;
  const barW = Math.max(6, (waveW - gap * (bars.length - 1)) / bars.length);
  const litUpTo = Math.floor(bars.length * Math.min(1, Math.max(0, progress)));

  ctx.fillStyle = ACID;
  ctx.beginPath();
  const cx = PAD + 22;
  const cy = waveY + waveH / 2;
  ctx.moveTo(cx, cy - 30);
  ctx.lineTo(cx + 48, cy);
  ctx.lineTo(cx, cy + 30);
  ctx.closePath();
  ctx.fill();

  bars.forEach((peak, i) => {
    const h = Math.max(10, peak * waveH);
    const x = PAD + glyphW + i * (barW + gap);
    ctx.fillStyle = i <= litUpTo ? ACID : LINE;
    roundRect(ctx, x, waveY + (waveH - h) / 2, barW, h, barW / 2);
    ctx.fill();
  });

  /* ---------------- footer ---------------- */
  const footY = CARD_H - 210;

  // Author avatar
  ctx.fillStyle = PIT;
  ctx.beginPath();
  ctx.arc(PAD + 46, footY, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ACID;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.font = fontStack(800, 40);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.fillText(authorName.slice(0, 1).toUpperCase(), PAD + 46, footY + 14);
  ctx.textAlign = "left";

  ctx.font = fontStack(800, 44);
  ctx.fillStyle = INK;
  ctx.fillText(authorName, PAD + 118, footY - 4);

  ctx.font = fontStack(600, 30, false);
  ctx.fillStyle = ACID;
  ctx.fillText(
    `WON WITH ${votes} VOTE${votes === 1 ? "" : "S"}`,
    PAD + 118,
    footY + 40,
  );

  // Handle, bottom-right
  ctx.font = fontStack(700, 34, false);
  ctx.fillStyle = DIM;
  ctx.textAlign = "right";
  ctx.fillText(handle, CARD_W - PAD, footY + 26);
  ctx.textAlign = "left";
}

/** Convenience: render a still to a Blob. */
export async function renderShareCardPng(
  data: ShareCardData,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  // Fonts must be loaded before measuring, or wrapping is computed against a
  // fallback and the layout shifts once the real face arrives.
  if (document.fonts?.ready) await document.fonts.ready;

  renderShareCard(ctx, data, 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

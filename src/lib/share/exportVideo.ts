/**
 * Renders the share card to a vertical VIDEO with the original audio muxed in.
 *
 * Why video and not just a still: a PNG can't carry the voice note, and the
 * voice note is the whole joke. A vertical video with burned-in caption is the
 * only format that works as a Reel, a TikTok, and a Story simultaneously —
 * and it plays silently for the majority who scroll muted, because the caption
 * carries it.
 *
 * Approach is entirely client-side: draw frames to a canvas, take
 * `canvas.captureStream()`, graft the audio track on, and feed the combined
 * MediaStream to MediaRecorder. No server, no ffmpeg, no upload.
 *
 * Same codec trap as audio recording: Safari will not produce WebM and needs
 * video/mp4. Negotiated, never hardcoded.
 */

import {
  CARD_H,
  CARD_W,
  renderShareCard,
  type ShareCardData,
} from "./renderShareCard";

const VIDEO_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // Safari + broad social support
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

export interface VideoFormat {
  mimeType: string;
  extension: string;
}

export function pickVideoFormat(): VideoFormat | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mimeType of VIDEO_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
      };
    }
  }
  return null;
}

export function isVideoExportSupported(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof canvas.captureStream === "function" &&
    pickVideoFormat() !== null
  );
}

export interface ExportResult {
  blob: Blob;
  url: string;
  format: VideoFormat;
  durationMs: number;
}

/**
 * @param audioUrl Object URL or same-origin URL for the winning clip.
 * @param onProgress 0..1, for a progress ring while rendering.
 */
export async function exportShareVideo(
  data: ShareCardData,
  audioUrl: string,
  onProgress?: (p: number) => void,
): Promise<ExportResult> {
  const format = pickVideoFormat();
  if (!format) throw new Error("Video export is not supported in this browser.");

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  if (document.fonts?.ready) await document.fonts.ready;

  /* ---------- audio graph ----------
     createMediaElementSource routes the element's output into our own
     destination node. We deliberately do NOT connect it to ctx.destination —
     that would play the clip out loud through the speakers while exporting. */
  const audio = new Audio();
  audio.src = audioUrl;
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    const ok = () => resolve();
    audio.addEventListener("loadedmetadata", ok, { once: true });
    audio.addEventListener(
      "error",
      () => reject(new Error("Could not load the clip audio.")),
      { once: true },
    );
    // Object URLs occasionally fire metadata before listeners attach
    if (audio.readyState >= 1) resolve();
  });

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") await audioCtx.resume();

  const source = audioCtx.createMediaElementSource(audio);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);

  /* ---------- combined stream ---------- */
  const fps = 30;
  const videoStream = canvas.captureStream(fps);
  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(combined, { mimeType: format.mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const started = performance.now();
  let raf = 0;

  const cleanup = () => {
    cancelAnimationFrame(raf);
    videoStream.getTracks().forEach((t) => t.stop());
    dest.stream.getTracks().forEach((t) => t.stop());
    audio.pause();
    void audioCtx.close();
  };

  const done = new Promise<ExportResult>((resolve, reject) => {
    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: format.mimeType });
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        format,
        durationMs: performance.now() - started,
      });
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error("Recording failed while exporting."));
    };
  });

  // Paint frame zero before the recorder starts so there's no black first frame
  renderShareCard(ctx, data, 0);
  recorder.start(200);
  await audio.play();

  const total =
    Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : 8;

  const draw = () => {
    const p = Math.min(1, audio.currentTime / total);
    renderShareCard(ctx, data, p);
    onProgress?.(p);
    if (audio.ended || p >= 1) {
      // Hold the completed frame briefly so the video doesn't cut dead on the
      // last syllable — it reads as an accident otherwise.
      setTimeout(() => {
        renderShareCard(ctx, data, 1);
        setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 380);
      }, 60);
      return;
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  return done;
}

/**
 * Hands the file to the OS share sheet when available, falling back to a
 * download. On iOS the share sheet is the only route into Instagram, so this
 * is the primary path, not a nicety.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: blob.type });

  if (
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], text });
      return "shared";
    } catch (err) {
      // AbortError = user dismissed the sheet; not a failure worth reporting
      if ((err as DOMException)?.name === "AbortError") return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

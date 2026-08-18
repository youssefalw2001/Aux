/**
 * MediaRecorder MIME type negotiation.
 *
 * This is the single most common reason voice recording silently fails on
 * iPhone: Safari does NOT support `audio/webm`. It requires `audio/mp4`
 * (AAC). Chrome, Firefox and Android Chrome want `audio/webm;codecs=opus`.
 *
 * Hardcoding either one ships a broken app to roughly half your users, and
 * it fails at `new MediaRecorder(...)` — after permission has been granted —
 * so it looks like a mic problem rather than a codec problem.
 *
 * Opus is decodable on Apple platforms, but Vorbis is not, so we never
 * request Vorbis.
 */

/** Ordered by preference: smallest/best first, Safari fallbacks after. */
const CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2", // Safari — AAC-LC
  "audio/mp4",
  "audio/aac",
] as const;

export interface RecordingFormat {
  /** Pass to `new MediaRecorder(stream, { mimeType })`. Empty = let the browser pick. */
  mimeType: string;
  /** File extension for the resulting Blob. */
  extension: string;
  /** True when we fell through to the browser default. */
  isFallback: boolean;
}

export function pickRecordingFormat(): RecordingFormat {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "", extension: "bin", isFallback: true };
  }

  for (const mimeType of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return {
        mimeType,
        extension: extensionFor(mimeType),
        isFallback: false,
      };
    }
  }

  // Last resort: omit mimeType entirely and let the UA choose. Still works
  // on some older WebViews that report nothing as supported.
  return { mimeType: "", extension: "bin", isFallback: true };
}

function extensionFor(mimeType: string): string {
  if (mimeType.startsWith("audio/webm")) return "webm";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  if (mimeType.startsWith("audio/mp4")) return "m4a";
  if (mimeType.startsWith("audio/aac")) return "aac";
  return "bin";
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

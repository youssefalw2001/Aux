import { ImageResponse } from "next/og";
import { loadBricolage } from "@/lib/og-font";
import { getRoomPreview } from "@/lib/rooms";

/**
 * THE UNFURL CARD.
 *
 * This is the highest-leverage surface in the entire product. When someone
 * pastes a room link into an Instagram group chat, this image is what the
 * other 6 people actually see — before any of them has opened the app. It is
 * the whole top of funnel.
 *
 * Two things make it convert:
 *  1. It's LIVE. It shows who has already joined, so the reader sees their
 *     friends' names, not a generic logo.
 *  2. It states the gap. "3 more to unlock" turns viewing into a task.
 */

export const alt = "Join the round on aux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Deterministic pseudo-random from the room code, so each room's waveform is
// visually distinct but stable across regenerations.
function seededBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Array.from({ length: count }, (_, i) => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const n = Math.abs(h % 1000) / 1000;
    // Bias toward a natural speech envelope: taller in the middle
    const envelope = Math.sin((i / count) * Math.PI) * 0.55 + 0.45;
    return Math.max(0.12, n * envelope);
  });
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const room = await getRoomPreview(code);
  const font = await loadBricolage(800);

  const bars = seededBars(code, 44);
  const needed = Math.max(0, room.minPlayers - room.players.length);

  // Optical sizing. Prompts vary from 40 to 110 characters, and a fixed size
  // makes long ones wrap to four lines and blow out the composition. Scaling
  // by length keeps every card the same visual weight.
  const prompt =
    room.prompt.length > 118
      ? `${room.prompt.slice(0, 115).trimEnd()}…`
      : room.prompt;
  const promptSize =
    prompt.length <= 52 ? 82 : prompt.length <= 80 ? 68 : 56;

  const ACID = "#c5f327";
  const VOID = "#14161c";
  const INK = "#f5f6f7";
  const DIM = "#8b8f9a";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: VOID,
          padding: "64px 72px",
          position: "relative",
        }}
      >
        {/* Acid bloom behind the composition. Satori renders blur poorly at
            large radii, so this is a soft radial gradient instead — same read,
            reliable output. */}
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -200,
            width: 760,
            height: 760,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${ACID}38 0%, ${ACID}14 45%, ${ACID}00 70%)`,
          }}
        />

        {/* --- Top row: wordmark + live pill --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontFamily: "Bricolage",
              fontSize: 46,
              color: ACID,
              letterSpacing: "-0.04em",
            }}
          >
            aux
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid #33363f`,
              borderRadius: 9999,
              padding: "10px 22px",
              fontSize: 22,
              color: DIM,
              letterSpacing: "0.14em",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 9999,
                background: ACID,
              }}
            />
            {room.players.length} IN ROOM
          </div>
        </div>

        {/* --- Middle: the hook --- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            flex: 1,
            justifyContent: "center",
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: ACID,
              letterSpacing: "0.2em",
              display: "flex",
            }}
          >
            ROUND {room.round} · VOICE ROULETTE
          </div>

          <div
            style={{
              fontFamily: "Bricolage",
              fontSize: promptSize,
              lineHeight: 1.04,
              color: INK,
              letterSpacing: "-0.035em",
              display: "flex",
              maxWidth: 960,
            }}
          >
            {prompt}
          </div>

          {/* Waveform — the brand motif */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 72,
            }}
          >
            {bars.map((b, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: Math.round(b * 72),
                  borderRadius: 9999,
                  background: i < bars.length * 0.55 ? ACID : "#33363f",
                }}
              />
            ))}
          </div>
        </div>

        {/* --- Bottom: the gap. This is what drives the invite. --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {room.players.slice(0, 5).map((p, i) => (
              <div
                key={i}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 9999,
                  background: "#252831",
                  border: `2px solid ${ACID}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: INK,
                  fontFamily: "Bricolage",
                }}
              >
                {p.slice(0, 1).toUpperCase()}
              </div>
            ))}
            <div style={{ fontSize: 26, color: DIM, display: "flex" }}>
              {room.players.slice(0, 3).join(", ")}
              {room.players.length > 3 ? ` +${room.players.length - 3}` : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              background: needed > 0 ? ACID : "#252831",
              color: needed > 0 ? VOID : INK,
              fontFamily: "Bricolage",
              fontSize: 30,
              padding: "20px 34px",
              borderRadius: 9999,
              letterSpacing: "-0.01em",
            }}
          >
            {needed > 0 ? `${needed} more to unlock` : "Tap to join"}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Bricolage", data: font, style: "normal", weight: 800 }]
        : undefined,
    },
  );
}

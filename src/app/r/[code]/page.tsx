import type { Metadata } from "next";
import { getRoomPreview } from "@/lib/rooms";
import { JoinScreen } from "./JoinScreen";

/**
 * Room entry point. This is the URL that gets pasted into the group chat, so
 * it has two jobs:
 *   1. Produce a great unfurl (see opengraph-image.tsx)
 *   2. Get a new player from tap to in-room with zero friction
 *
 * There is deliberately NO login. Links from Instagram DMs open in Instagram's
 * in-app WebView, where OAuth and passkeys are broken or feel broken, and
 * there is no PWA install prompt. Anonymous session + device ID only.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const room = await getRoomPreview(code);
  const needed = Math.max(0, room.minPlayers - room.players.length);

  return {
    title: `Round ${room.round} · aux`,
    description:
      needed > 0
        ? `${room.players.length} in the room. ${needed} more to unlock the reveal.`
        : `${room.players.length} in the room. Tap to join.`,
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const room = await getRoomPreview(code);

  return <JoinScreen room={room} />;
}

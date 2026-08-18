"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PartySocket from "partysocket";
import type {
  ClientMessage,
  RoomState,
  ServerMessage,
} from "./protocol";

/**
 * Client connection to a room's Durable Object.
 *
 * PartySocket handles reconnection with backoff, which matters a lot here:
 * Instagram's in-app WebView suspends background tabs aggressively, so sockets
 * drop constantly during normal play. The server keys players by deviceId
 * specifically so these reconnects are invisible to the game.
 */

const DEVICE_KEY = "aux:deviceId";

/** Stable per-browser id. This is our entire identity system — no accounts. */
function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export type ConnStatus = "connecting" | "open" | "closed";

interface Options {
  code: string;
  name: string | null;
  /** Worker origin, e.g. https://aux-rooms.<sub>.workers.dev */
  host?: string;
}

export function useRoom({ code, name, host }: Options) {
  const [state, setState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);

  const socketRef = useRef<PartySocket | null>(null);

  const resolvedHost = useMemo(
    () =>
      host ??
      process.env.NEXT_PUBLIC_ROOM_HOST ??
      (typeof window !== "undefined" ? "localhost:8787" : "localhost:8787"),
    [host],
  );

  useEffect(() => {
    if (!code || !name) return;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    const socket = new PartySocket({
      host: resolvedHost,
      party: "aux-room",
      room: code,
    });
    socketRef.current = socket;

    const onOpen = () => {
      setStatus("open");
      // Re-join on every open, including reconnects. The server treats a
      // repeat join from the same deviceId as a resume, not a new player, so
      // this is safe to fire on every socket open.
      socket.send(
        JSON.stringify({
          type: "join",
          deviceId,
          name,
        } satisfies ClientMessage),
      );
    };

    const onMessage = (e: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "state") setState(msg.state);
      else if (msg.type === "you") setPlayerId(msg.playerId);
      else if (msg.type === "error") setLastError(msg.message);
    };

    const onClose = () => setStatus("closed");
    const onError = () => setStatus("closed");

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onError);

    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
      socket.close();
      socketRef.current = null;
    };
  }, [code, name, resolvedHost]);

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(msg));
    return true;
  }, []);

  const me = useMemo(
    () => state?.players.find((p) => p.id === playerId) ?? null,
    [state, playerId],
  );

  return {
    state,
    me,
    playerId,
    status,
    lastError,
    clearError: useCallback(() => setLastError(null), []),
    send,
    start: useCallback(() => send({ type: "start" }), [send]),
    submit: useCallback(
      (clipUrl: string, peaks: number[], durationMs: number) =>
        send({ type: "submit", clipUrl, peaks, durationMs }),
      [send],
    ),
    vote: useCallback(
      (targetId: string) => send({ type: "vote", targetId }),
      [send],
    ),
    advance: useCallback(() => send({ type: "advance" }), [send]),
  };
}

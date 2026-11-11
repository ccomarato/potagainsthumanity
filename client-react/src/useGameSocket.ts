import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerEvent, Sync } from "./types";

export type SocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface GameSocket {
  status: SocketStatus;
  /** The latest Sync payload, or null until the first one arrives. */
  sync: Sync | null;
  /** Local timestamp (Date.now()) when the current Sync was received. */
  syncReceivedAt: number | null;
  /** Name of the most recent non-Sync event received. */
  lastEvent: string | null;
  /** The latest server rejection (e.g. a refused Configure), if any. */
  lastError: string | null;
  /** Recent non-Sync event names, newest first (max 20). */
  eventLog: string[];
  /** Force a fresh Sync (close + reconnect). */
  resync: () => void;
  /** Send a raw action object over the socket (Phase 1+). */
  send: (action: Record<string, unknown>) => void;
  /** Close the socket and stop reconnecting. */
  disconnect: () => void;
}

const BACKOFF_START_MS = 500;
const BACKOFF_MAX_MS = 60_000;
const RESYNC_DEBOUNCE_MS = 250;
const MAX_EVENT_LOG = 20;

/**
 * One WebSocket per game, speaking the server's protocol:
 *
 *   1. Open ws(s)://<host>/api/games/:gameCode
 *   2. First message MUST be {"action":"Authenticate","token":<jwt>}
 *   3. Server replies with a Sync event (full censored game state
 *      plus your private hand / play / likeDetail / calls).
 *
 * Safety net (from REACT_PLAN.md): incremental events after Sync are
 * not applied in Phase 0. Instead, any non-Sync event triggers a
 * re-sync — close the socket and reconnect for a fresh Sync.
 * Re-authenticating on the SAME socket is not an option: the server
 * throws AlreadyAuthenticatedError if Authenticate is sent twice on
 * one connection (verified in server/src/ts/action.ts).
 *
 * Reconnect backoff: 0.5s, doubling, capped at 60s, reset on a
 * successful Sync — the same ladder the old client used.
 *
 * Privacy: Sync payloads are never logged. In dev, only event
 * *names* are logged — never payloads, which contain your hand.
 */
export function useGameSocket(
  gameCode: string | null,
  token: string | null,
): GameSocket {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const [sync, setSync] = useState<Sync | null>(null);
  const [syncReceivedAt, setSyncReceivedAt] = useState<number | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(BACKOFF_START_MS);
  const reconnectTimerRef = useRef<number | null>(null);
  const resyncPendingRef = useRef(false);
  const resyncCloseRef = useRef(false);
  const intentionalCloseRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleReconnect = useCallback((delayMs: number) => {
    clearReconnectTimer();
    setStatus("reconnecting");
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRef.current();
    }, delayMs);
  }, []);

  /** Close + reconnect for a fresh Sync. Debounced: bursts of events coalesce into one reconnect. */
  const resync = useCallback(() => {
    if (resyncPendingRef.current) return;
    resyncPendingRef.current = true;
    window.setTimeout(() => {
      resyncPendingRef.current = false;
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Mark this close as a deliberate re-sync so the close
        // handler does not also start the failure backoff ladder.
        resyncCloseRef.current = true;
        socket.close();
      }
      scheduleReconnect(RESYNC_DEBOUNCE_MS);
    }, RESYNC_DEBOUNCE_MS);
  }, [scheduleReconnect]);

  const connect = useCallback(() => {
    if (!gameCode || !token) return;
    intentionalCloseRef.current = false;
    clearReconnectTimer();
    setStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/games/${encodeURIComponent(gameCode)}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ action: "Authenticate", token }));
    });

    socket.addEventListener("message", (message) => {
      let data: ServerEvent;
      try {
        data = JSON.parse(message.data as string) as ServerEvent;
      } catch {
        return;
      }
      if (data.event === "Sync") {
        const payload = data as Sync;
        setSync(payload);
        setSyncReceivedAt(Date.now());
        setLastError(null);
        backoffRef.current = BACKOFF_START_MS;
        setStatus("connected");
        return;
      }
      // A rejected action arrives without an `event` field, as
      // { error, reason }. Surface the reason so the UI can show
      // why a Configure (or any action) was refused.
      const errorField = (data as { error?: unknown }).error;
      if (typeof errorField === "string") {
        const reason = (data as { reason?: unknown }).reason;
        setLastError(
          typeof reason === "string" ? `${errorField}: ${reason}` : errorField,
        );
      }
      // Phase 0 does not apply incremental events. Record the name
      // and re-sync for a fresh Sync instead.
      const name = typeof errorField === "string" ? "Error" : (data.event ?? "Unknown");
      if (import.meta.env.DEV) {
        // Event names only — never payloads.
        console.debug(`[game-socket] event ${name}, re-syncing`);
      }
      setLastEvent(name);
      setEventLog((log) => [name, ...log].slice(0, MAX_EVENT_LOG));
      resync();
    });

    socket.addEventListener("close", () => {
      if (socketRef.current === socket) socketRef.current = null;
      if (intentionalCloseRef.current) {
        setStatus("closed");
        return;
      }
      if (resyncCloseRef.current) {
        // Deliberate re-sync close — a reconnect is already
        // scheduled; do not also climb the failure backoff ladder.
        resyncCloseRef.current = false;
        return;
      }
      // Unplanned close: reconnect with backoff.
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, BACKOFF_MAX_MS);
      scheduleReconnect(delay);
    });

    socket.addEventListener("error", () => {
      // The close event follows and drives the reconnect.
    });
  }, [gameCode, token, resync, scheduleReconnect]);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    resyncPendingRef.current = false;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        // Best effort: tell the server we left instead of letting
        // the disconnect grace period expire.
        socket.send(JSON.stringify({ action: "Leave" }));
      } catch {
        // Socket is going away anyway.
      }
      socket.close();
    }
    setStatus("closed");
  }, []);

  const send = useCallback((action: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(action));
    }
  }, []);

  useEffect(() => {
    if (!gameCode || !token) {
      setStatus("closed");
      return;
    }
    backoffRef.current = BACKOFF_START_MS;
    connect();
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      resyncPendingRef.current = false;
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) socket.close();
    };
  }, [gameCode, token, connect]);

  return {
    status,
    sync,
    syncReceivedAt,
    lastEvent,
    lastError,
    eventLog,
    resync,
    send,
    disconnect,
  };
}

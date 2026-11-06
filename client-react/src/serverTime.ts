import { useEffect, useState } from "react";
import type { Sync } from "./types";

/**
 * Estimate the server's current clock from the Sync anchor.
 *
 * The server sends `gameTime` (its Date.now() at Sync time). The
 * local clock is never trusted on its own: serverNow is the anchor
 * plus the local time elapsed since the Sync arrived. Drift over a
 * single Sync lifetime is negligible for a stage timer.
 *
 * Returns null until the first Sync arrives.
 */
export function useServerNow(sync: Sync | null, syncReceivedAt: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!sync || syncReceivedAt === null) {
      setNow(null);
      return;
    }
    const tick = () => {
      setNow(sync.gameTime + (Date.now() - syncReceivedAt));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [sync, syncReceivedAt]);

  return now;
}

/** Format a millisecond duration as m:ss, clamping at 0. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

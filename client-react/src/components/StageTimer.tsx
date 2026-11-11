import type { PublicRound, Stages } from "../types";
import { formatRemaining } from "../serverTime";

function stageDurationSeconds(stage: PublicRound["stage"], stages: Stages): number | undefined {
  switch (stage) {
    case "Starting":
      return stages.starting;
    case "Playing":
      return stages.playing.duration;
    case "Revealing":
      return stages.revealing?.duration;
    case "Judging":
      return stages.judging.duration;
    default:
      return undefined;
  }
}

/**
 * Stage timer, derived from the server clock anchor — never from the
 * local clock alone. `serverNow` comes from useServerNow (Sync
 * gameTime + local elapsed time) and `startedAt` is the server
 * timestamp for when this stage began.
 */
export function StageTimer({
  round,
  stages,
  serverNow,
}: {
  round: PublicRound;
  stages: Stages;
  serverNow: number | null;
}) {
  const duration = stageDurationSeconds(round.stage, stages);

  if (round.stage === "Complete") {
    return <span className="text-sm text-purple-200">Round over</span>;
  }
  if (duration === undefined) {
    return <span className="text-sm text-purple-200">No time limit</span>;
  }
  if (serverNow === null) {
    return <span className="text-sm text-purple-200">Waiting for clock…</span>;
  }

  const totalMs = duration * 1000;
  const elapsedMs = serverNow - round.startedAt;
  const remainingMs = totalMs - elapsedMs;
  const overtime = remainingMs < 0;
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-purple-900">
        <div
          className={`h-full rounded-full ${overtime ? "bg-red-400" : "bg-yellow-300"}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className={`font-mono text-sm font-bold ${overtime ? "text-red-300" : "text-yellow-200"}`}>
        {overtime ? "Time up" : formatRemaining(remainingMs)}
      </span>
      {round.timedOut ? <span className="text-xs text-purple-300">(timed out)</span> : null}
    </div>
  );
}

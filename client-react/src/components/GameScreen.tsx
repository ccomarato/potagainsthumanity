import { useEffect, useRef } from "react";
import { useGameSocket } from "../useGameSocket";
import { useServerNow } from "../serverTime";
import { CallCardView } from "./CallCard";
import { ConfigTabs } from "./ConfigTabs";
import { StageTimer } from "./StageTimer";
import type { Session } from "./StartScreen";
import type { PublicGame, ResponseCard, Sync } from "../types";

/** Read the uid claim out of the JWT (no verification — display only). */
function decodeUid(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { uid?: string };
    return json.uid ?? null;
  } catch {
    return null;
  }
}

function statusPill(status: string): string {
  switch (status) {
    case "connected":
      return "bg-green-500/20 text-green-300 border-green-500/40";
    case "connecting":
    case "reconnecting":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
    default:
      return "bg-gray-500/20 text-gray-300 border-gray-500/40";
  }
}

/**
 * Phase 0 game view: renders the latest Sync payload read-only.
 *
 * What you see here is exactly what the server sent:
 * - Public game state (players, config, game, scores).
 * - Your OWN hand, your submitted play, your likes, and — if you
 *   are the Head Hobo during Starting — the calls to pick from.
 * Nothing else is rendered: the server never sends another player's
 * hand, and this client never asks for it.
 */
export function GameScreen({
  session,
  onLeave,
}: {
  session: Session;
  onLeave: () => void;
}) {
  const { status, sync, syncReceivedAt, lastEvent, lastError, eventLog, resync, send, disconnect } =
    useGameSocket(session.gameCode, session.token);
  const serverNow = useServerNow(sync, syncReceivedAt);
  const myUid = decodeUid(session.token);

  // Flip the game's public/private listing (owner only). The server has
  // no "public" field on create, so visibility is a config change: an
  // RFC 6902 patch against the censored config with a version test, so a
  // stale edit is rejected instead of overwriting someone else's change.
  const makePublicDone = useRef(false);
  const makePublicAttempts = useRef(0);
  const setVisibility = (makePublic: boolean) => {
    if (!sync || status !== "connected") return;
    const isPublic = sync.state.config.public === true;
    if (makePublic === isPublic) return; // Already in the desired state.
    makePublicDone.current = true;
    // RFC 6902: `replace` needs the key to exist. The censored config
    // only includes `public` when it is true, so making a private game
    // public is an `add`; making a public game private is a `replace`
    // (the key exists by then). The version test rejects a stale edit.
    send({
      action: "Configure",
      change: [
        { op: "test", path: "/version", value: sync.state.config.version },
        makePublic
          ? { op: "add", path: "/public", value: true }
          : { op: "replace", path: "/public", value: false },
      ],
    });
  };

  // If this game was created with "List as a public game" ticked, flip
  // it public as soon as the first Sync arrives. Stops once the server
  // confirms it is public, after 3 tries, or if the owner flips it by
  // hand (which also marks the request done).
  useEffect(() => {
    if (!session.makePublic || !session.isOwner || !sync) return;
    if (makePublicDone.current) return;
    if (sync.state.config.public === true) {
      makePublicDone.current = true;
      return;
    }
    if (makePublicAttempts.current >= 3) return;
    makePublicAttempts.current += 1;
    setVisibility(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync, session, send]);

  const handleLeave = () => {
    disconnect();
    onLeave();
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">
            {sync ? sync.state.config.name : "Game"}
          </h1>
          <p className="font-mono text-sm text-purple-300">
            Code: {session.gameCode} · You: {session.displayName}
            {session.isOwner ? " (owner)" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusPill(status)}`}>
            {status === "connected"
              ? "● Live"
              : status === "connecting"
                ? "○ Connecting…"
                : status === "reconnecting"
                  ? "○ Reconnecting…"
                  : "○ Disconnected"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resync}
              className="rounded-lg border border-purple-600 px-2.5 py-1 text-xs text-purple-200 hover:bg-purple-800"
            >
              Re-sync
            </button>
            <button
              type="button"
              onClick={handleLeave}
              className="rounded-lg border border-red-400/60 px-2.5 py-1 text-xs text-red-200 hover:bg-red-950"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      {status !== "connected" && !sync ? (
        <div className="rounded-2xl bg-purple-900/50 p-5 text-sm text-purple-200 shadow-lg">
          {status === "connecting"
            ? "Opening the WebSocket and authenticating…"
            : status === "reconnecting"
              ? "Connection dropped — reconnecting with backoff (0.5s, doubling to 60s)…"
              : "Not connected."}
        </div>
      ) : null}

      {sync ? (
        <SyncView
          sync={sync}
          serverNow={serverNow}
          myUid={myUid}
          isOwner={session.isOwner}
          send={send}
          lastError={lastError}
        />
      ) : null}

      <section className="rounded-2xl bg-purple-900/50 p-4 shadow-lg">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
          Live events
        </h2>
        <p className="mb-2 text-xs text-purple-300">
          Phase 0 does not apply incremental events yet — each one triggers
          a re-sync (fresh Sync over a new socket). Last event:{" "}
          <span className="font-mono text-purple-100">{lastEvent ?? "none yet"}</span>
        </p>
        {eventLog.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {eventLog.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="rounded-full bg-purple-950/70 px-2 py-0.5 font-mono text-xs text-purple-200"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-purple-400">No events since the last Sync.</p>
        )}
      </section>

      {sync ? (
        <details className="rounded-2xl bg-purple-950/60 p-4 text-xs">
          <summary className="cursor-pointer font-bold text-purple-200">
            Raw public game state (debug — public fields only, never your hand)
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-purple-300">
            {JSON.stringify(sync.state, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

/** Server house-rule keys -> the original client's display names. */
const HOUSE_RULE_NAMES: { [key: string]: string } = {
  winnersPick: "Head Hobo's Pick",
  rando: "Retard in Boy's Room",
  packingHeat: "Packing a Blackjack",
  reboot: "The Crackdown",
  happyEnding: "Happy Ending",
  czarChoices: "Head Hobo Choices",
  comedyWriter: "Comedy Writer",
  neverHaveIEver: "Never Have I Ever",
};

function SyncView({
  sync,
  serverNow,
  myUid,
  isOwner,
  send,
  lastError,
}: {
  sync: Sync;
  serverNow: number | null;
  myUid: string | null;
  isOwner: boolean;
  send: (action: Record<string, unknown>) => void;
  lastError: string | null;
}) {
  const state = sync.state;
  const game = state.game;

  // Server house-rule keys -> the original client's display names.
  // The read-only list (non-owner view) used to show the raw keys.
  const houseRules = Object.entries(state.config.rules.houseRules)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k]) => HOUSE_RULE_NAMES[k] ?? k);

  return (
    <>
      <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
        <h2 className="mb-3 text-lg font-bold text-white">
          Players ({Object.keys(state.users).length})
        </h2>
        <ul className="flex flex-col gap-2">
          {Object.entries(state.users).map(([id, user]) => {
            const player = game?.players[id];
            const isCzar = game?.round.czar === id;
            const isMe = id === myUid;
            const isOwner = id === state.owner;
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-xl bg-purple-950/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">
                    {user.name}
                    {isMe ? <span className="text-yellow-300"> (you)</span> : ""}
                    {isOwner ? <span className="text-purple-300"> · owner</span> : ""}
                    {isCzar ? <span className="text-yellow-300"> · Head Hobo</span> : ""}
                  </p>
                  <p className="text-xs text-purple-300">
                    {user.role} · {user.presence} · {user.connection}
                    {user.privilege === "Privileged" ? " · privileged" : ""}
                    {user.control === "Computer" ? " · computer" : ""}
                    {player ? ` · ${player.presence === "Away" ? "away" : "active"}` : ""}
                  </p>
                </div>
                {player ? (
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-lg font-bold text-white">{player.score}</p>
                    <p className="text-[11px] text-purple-300">
                      {player.likes} like{player.likes === 1 ? "" : "s"}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {state.errors && state.errors.length > 0 ? (
          <div className="mt-3 rounded-xl border border-red-400/60 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {state.errors.map((e, i) => (
              <p key={i}>{e.error}</p>
            ))}
          </div>
        ) : null}
      </section>

      {isOwner ? (
        <ConfigTabs config={state.config} send={send} lastError={lastError} />
      ) : (
      <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
        <h2 className="mb-3 text-lg font-bold text-white">Game settings</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-purple-300">Hand size</dt>
          <dd className="text-right font-bold text-white">{state.config.rules.handSize}</dd>
          <dt className="text-purple-300">Score limit</dt>
          <dd className="text-right font-bold text-white">
            {state.config.rules.scoreLimit ?? "none"}
          </dd>
          <dt className="text-purple-300">Time limits</dt>
          <dd className="text-right font-bold text-white">
            {state.config.rules.stages.timeLimitMode}
          </dd>
          <dt className="text-purple-300">Visibility</dt>
          <dd className="text-right font-bold text-white">
            {state.config.public ? "Public" : "Private"}
            {state.config.audienceMode ? " · audience mode" : ""}
          </dd>
          <dt className="text-purple-300">Decks</dt>
          <dd className="text-right font-mono text-xs text-white">
            {state.config.decks.map((d, i) => (
              <span key={i} className="block">
                {JSON.stringify(d.source)}
              </span>
            ))}
          </dd>
        </dl>
        {houseRules.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1 text-sm text-purple-300">House rules on:</p>
            <ul className="flex flex-wrap gap-1.5">
              {houseRules.map((rule) => (
                <li
                  key={rule}
                  className="rounded-full bg-purple-950/70 px-2 py-0.5 text-xs font-bold text-purple-100"
                >
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-purple-300">No house rules on.</p>
        )}
      </section>
      )}

      {game ? (
        <GameView state={state} serverNow={serverNow} />
      ) : (
        <section className="rounded-2xl bg-purple-900/50 p-5 text-center shadow-lg">
          <p className="font-bold text-white">Waiting to start</p>
          <p className="mt-1 text-sm text-purple-300">
            The owner starts the game. (Start controls arrive in Phase 1.)
          </p>
        </section>
      )}

      <PrivateState sync={sync} />
    </>
  );
}

function GameView({ state, serverNow }: { state: PublicGame; serverNow: number | null }) {
  const game = state.game;
  if (!game) return null;
  const round = game.round;
  const nameOf = (id: string) => state.users[id]?.name ?? id;
  const winnerNames = game.winner?.map(nameOf).join(", ");

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-purple-900/50 p-5 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          {round.stage === "Complete" ? "Round complete" : `Stage: ${round.stage}`}
        </h2>
        <StageTimer round={round} stages={game.rules.stages} serverNow={serverNow} />
      </div>

      <p className="text-sm text-purple-200">
        Head Hobo: <span className="font-bold text-white">{nameOf(round.czar)}</span>
        {game.paused ? <span className="ml-2 text-yellow-300">· Paused</span> : ""}
      </p>

      {"call" in round && round.call ? <CallCardView call={round.call} /> : null}

      {round.stage === "Playing" ? (
        <p className="text-sm text-purple-200">
          {round.played.length} of {round.players.length} submitted a play.
        </p>
      ) : null}

      {round.stage === "Revealing" || round.stage === "Judging" ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-purple-300">Plays</h3>
          {round.plays.map((play) => (
            <div key={play.id} className="rounded-xl bg-white p-3 text-sm shadow">
              {play.play ? (
                <ul className="flex flex-col gap-1">
                  {play.play.map((card) => (
                    <li key={card.id} className="font-bold text-gray-900">
                      {card.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="italic text-gray-500">[not revealed yet]</p>
              )}
              {play.likes !== undefined && play.likes > 0 ? (
                <p className="mt-1 text-xs text-gray-500">
                  ♥ {play.likes} like{play.likes === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {round.stage === "Complete" ? (
        <p className="text-sm text-purple-200">
          Winner: <span className="font-bold text-yellow-300">{nameOf(round.winner)}</span>
        </p>
      ) : null}

      {winnerNames ? (
        <p className="rounded-xl bg-yellow-300/20 px-3 py-2 text-sm font-bold text-yellow-200">
          Game winner: {winnerNames}
        </p>
      ) : null}

      {game.history.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-bold text-purple-200">
            Round history ({game.history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-purple-200">
            {game.history.map((past) => (
              <li key={past.id}>
                Round {past.id.slice(0, 8)}… — won by {nameOf(past.winner)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Private Sync fields: only ever the current user's own data. */
function PrivateState({ sync }: { sync: Sync }) {
  const hasPrivate =
    sync.hand !== undefined ||
    sync.play !== undefined ||
    sync.likeDetail !== undefined ||
    sync.calls !== undefined;

  return (
    <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
      <h2 className="mb-1 text-lg font-bold text-white">Your private state</h2>
      <p className="mb-3 text-xs text-purple-300">
        Only you see this — it comes from your Sync, never from another player.
      </p>

      {sync.calls && sync.calls.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
            Calls to pick from (you are the Head Hobo)
          </h3>
          <div className="flex flex-col gap-2">
            {sync.calls.map((call) => (
              <CallCardView key={call.id} call={call} />
            ))}
          </div>
        </div>
      ) : null}

      {sync.hand ? (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
            Your hand ({sync.hand.length} cards)
          </h3>
          <ul className="flex flex-col gap-2">
            {sync.hand.map((card: ResponseCard) => (
              <li
                key={card.id}
                className={`rounded-xl bg-white p-3 text-sm font-bold shadow ${
                  sync.play?.includes(card.id) ? "text-gray-400 line-through" : "text-gray-900"
                }`}
              >
                {card.text}
                {sync.play?.includes(card.id) ? (
                  <span className="ml-2 text-xs font-normal text-gray-500">(submitted)</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-4 text-sm text-purple-300">
          No hand in this Sync — hands only exist once a game is running and you are a player.
        </p>
      )}

      {sync.likeDetail ? (
        <p className="text-sm text-purple-200">
          You liked {sync.likeDetail.liked.length} play
          {sync.likeDetail.liked.length === 1 ? "" : "s"} this round
          {sync.likeDetail.played ? " · your play is in" : ""}.
        </p>
      ) : null}

      {!hasPrivate ? (
        <p className="text-sm text-purple-300">
          Nothing private in this Sync yet — join a game and your hand will appear here.
        </p>
      ) : null}

      {sync.gameTime ? (
        <p className="mt-3 text-xs text-purple-400">
          Server clock anchor: {new Date(sync.gameTime).toLocaleTimeString()} (gameTime). Stage
          timers are derived from this anchor, not your device clock.
        </p>
      ) : null}
    </section>
  );
}

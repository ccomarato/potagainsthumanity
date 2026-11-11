import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createGame, getVersion, joinGame, listGames } from "../api";
import type { GameSummary } from "../types";

export interface Session {
  gameCode: string;
  token: string;
  displayName: string;
  /** True when this session created the game (the owner). */
  isOwner: boolean;
  /** True when the owner ticked "List as a public game" on create. */
  makePublic?: boolean;
}

type StartTab = "new" | "join" | "find" | "about";

const START_TABS: { id: StartTab; label: string }[] = [
  { id: "new", label: "New" },
  { id: "join", label: "Join" },
  { id: "find", label: "Find" },
  { id: "about", label: "About" },
];

function inputClass(extra = ""): string {
  return `w-full rounded-xl border border-purple-700 bg-purple-950/60 px-3 py-2 text-white placeholder:text-purple-400 focus:border-yellow-300 focus:outline-none ${extra}`;
}

/**
 * Branded card pair for the create-game page: a black call card reading
 * "PoT Against Humanity" overlapped by a white answer card with the
 * tagline. No lightning-bolt background — the old client's bolt pattern
 * is deliberately not carried over; the page keeps the new design's
 * deep-purple gradient.
 */
function CardHero() {
  return (
    <div
      role="img"
      aria-label="PoT Against Humanity — the recognized symbol of excellence in online gaming."
      className="relative mx-auto h-60 w-full max-w-[300px]"
    >
      <div className="absolute left-0 top-0 h-56 w-40 -rotate-6 rounded-2xl bg-black p-4 shadow-2xl shadow-black/60">
        <p className="text-2xl font-black leading-tight text-white">
          PoT
          <br />
          Against
          <br />
          Humanity
        </p>
      </div>
      <div className="absolute right-0 top-4 h-56 w-40 rotate-3 rounded-2xl bg-white p-4 shadow-2xl shadow-black/60">
        <p className="text-lg font-bold leading-snug text-purple-950">
          The recognized symbol of excellence in online gaming.
        </p>
      </div>
    </div>
  );
}

/**
 * Start page, like the old client's New / Join / Find / About tabs.
 * One tab is visible at a time, on every screen size — on mobile each
 * tab is a portrait single-column panel, and on a PC the panel is
 * wider instead of a narrow centered column.
 */
export function StartScreen({ onEnter }: { onEnter: (session: Session) => void }) {
  const [activeTab, setActiveTab] = useState<StartTab>("new");
  const [version, setVersion] = useState<string | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createGameName, setCreateGameName] = useState("");
  const [createPlayerName, setCreatePlayerName] = useState("");
  const [createPublic, setCreatePublic] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPlayerName, setJoinPlayerName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
    refreshGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The public list goes stale fast — refresh it whenever the Find
  // tab is opened, not just on first load.
  useEffect(() => {
    if (activeTab === "find") refreshGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function refreshGames() {
    try {
      setGames(await listGames());
      setGamesError(null);
    } catch (e) {
      setGamesError(e instanceof Error ? e.message : "Could not list games.");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token, gameCode } = await createGame({
        name: createGameName.trim(),
        owner: { name: createPlayerName.trim() },
      });
      onEnter({
        gameCode,
        token,
        displayName: createPlayerName.trim(),
        isOwner: true,
        makePublic: createPublic,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the game.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const token = await joinGame(code, {
        name: joinPlayerName.trim(),
        ...(joinPassword ? { password: joinPassword } : {}),
      });
      onEnter({ gameCode: code, token, displayName: joinPlayerName.trim(), isOwner: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the game.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinListed(game: GameSummary) {
    if (!joinPlayerName.trim()) {
      setError("Enter your name above first, then pick a game to join.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const token = await joinGame(game.gameCode, { name: joinPlayerName.trim() });
      onEnter({ gameCode: game.gameCode, token, displayName: joinPlayerName.trim(), isOwner: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:max-w-2xl">
      <header className="text-center">
        <CardHero />
        <p className="mt-1 text-sm text-purple-300">
          Phase 0 scaffold: create, join, sync.
        </p>
      </header>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-400/60 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <nav className="flex gap-1 rounded-full bg-purple-950/70 p-1" role="tablist" aria-label="Start">
        {START_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-full px-2 py-2 text-sm font-bold sm:text-base ${
              activeTab === t.id
                ? "bg-yellow-300 text-purple-950"
                : "text-purple-200 hover:bg-purple-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === "new" ? (
        <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
          <h2 className="mb-3 text-lg font-bold text-white">Create a game</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-purple-200">Game name</span>
              <input
                className={inputClass()}
                value={createGameName}
                onChange={(e) => setCreateGameName(e.target.value)}
                placeholder="e.g. Friday night"
                required
                minLength={1}
                maxLength={100}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-purple-200">Your name</span>
              <input
                className={inputClass()}
                value={createPlayerName}
                onChange={(e) => setCreatePlayerName(e.target.value)}
                placeholder="e.g. Christopher"
                required
                minLength={1}
                maxLength={100}
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-purple-200">
              <input
                type="checkbox"
                checked={createPublic}
                onChange={(e) => setCreatePublic(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-yellow-300"
              />
              <span>
                List as a public game
                <span className="block text-xs text-purple-400">
                  Anyone can find and join it. Leave off to keep it private — only people with
                  the game code can join.
                </span>
              </span>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-yellow-300 px-4 py-2.5 font-bold text-purple-950 transition hover:bg-yellow-200 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create game"}
            </button>
          </form>
          <p className="mt-2 text-xs text-purple-300">
            Server defaults apply (hand of 10, first to 7, Head Hobo's Pick on). Decks, rules,
            time limits and privacy are set in the game screen once you are in.
          </p>
        </section>
      ) : null}

      {activeTab === "join" ? (
        <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
          <h2 className="mb-3 text-lg font-bold text-white">Join a game</h2>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-purple-200">Game code</span>
              <input
                className={inputClass("uppercase")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. AB12CD"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-purple-200">Your name</span>
              <input
                className={inputClass()}
                value={joinPlayerName}
                onChange={(e) => setJoinPlayerName(e.target.value)}
                placeholder="Must be unique in the game"
                required
                minLength={1}
                maxLength={100}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-purple-200">
                Game password <span className="text-purple-400">(only if the game has one)</span>
              </span>
              <input
                className={inputClass()}
                type="password"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-white px-4 py-2.5 font-bold text-purple-950 transition hover:bg-purple-100 disabled:opacity-50"
            >
              {busy ? "Joining…" : "Join game"}
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "find" ? (
        <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Public games</h2>
            <button
              type="button"
              onClick={refreshGames}
              className="rounded-lg border border-purple-600 px-3 py-1 text-sm text-purple-200 hover:bg-purple-800"
            >
              Refresh
            </button>
          </div>
          <label className="mb-3 block">
            <span className="mb-1 block text-sm text-purple-200">Your name</span>
            <input
              className={inputClass()}
              value={joinPlayerName}
              onChange={(e) => setJoinPlayerName(e.target.value)}
              placeholder="Enter your name, then pick a game below"
              minLength={1}
              maxLength={100}
            />
          </label>
          {gamesError ? (
            <p className="text-sm text-red-300">{gamesError}</p>
          ) : games.length === 0 ? (
            <p className="text-sm text-purple-300">
              No public games right now — create one on the New tab. (Most games are private by
              default, so they never appear here.)
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {games.map((game) => (
                <li
                  key={game.gameCode}
                  className="flex items-center justify-between gap-3 rounded-xl bg-purple-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{game.name}</p>
                    <p className="text-xs text-purple-300">
                      {game.gameCode} · {game.state} · {game.users.players} player
                      {game.users.players === 1 ? "" : "s"}
                      {game.users.spectators > 0 ? ` · ${game.users.spectators} watching` : ""}
                      {game.password ? " · password" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoinListed(game)}
                    disabled={busy || game.password === true}
                    title={game.password ? "Password games: use the Join tab" : undefined}
                    className="shrink-0 rounded-lg bg-yellow-300 px-3 py-1.5 text-sm font-bold text-purple-950 hover:bg-yellow-200 disabled:opacity-50"
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === "about" ? (
        <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
          <h2 className="mb-3 text-lg font-bold text-white">
            What is PoT Against Humanity?
          </h2>
          <div className="flex flex-col gap-3 text-sm text-purple-200">
            <p>
              PoT Against Humanity is the recognized symbol of excellence in online gaming
              inspired by Pod of Thunder, the recognized symbol of excellence in rock and roll
              podcasting, and Cards Against Humanity. It was developed by a hobo from the
              Republic of Podthundistan as a heavily bastardized fork of the GitHub project
              Massive Decks.
            </p>
            <h3 className="mt-2 text-base font-bold text-white">How to play:</h3>
            <p>Each player has a hand of White Cards.</p>
            <p>
              The first player begins as the Head Hobo. The Head Hobo reads the question or
              fill-in-the-blank phrase on the Black Card out loud.
            </p>
            <p>
              Everyone else answers the question or fills in the blank by choosing a White Card
              from their hand to play for the round.
            </p>
            <p>
              The answers are then shuffled, and the Head Hobo reads them out to the other
              players. For full effect, it is suggested that the Head Hobo reread the Black
              Card before presenting each answer. The Head Hobo then picks the funniest answer,
              and the player who played it gets one Boner Point.
            </p>
            <figure className="my-1">
              <div className="w-40 rounded-2xl bg-black p-4 shadow-xl">
                <p className="text-lg font-black leading-snug text-white">
                  ___ + ___ = ___
                </p>
              </div>
              <figcaption className="mt-2 text-xs text-purple-400">
                Black Cards like this will require picking more White Cards, but give you more
                to pick from.
              </figcaption>
            </figure>
            <h3 className="mt-2 text-base font-bold text-white">Pick 2</h3>
            <p>
              Some Black Cards will need more than one White Card as an answer. Play the cards
              in the order the Head Hobo should read them—the order matters.
            </p>
            <p>
              Some Black Cards will need even more White Cards—these will say Draw 2 or more,
              and the player will receive that many extra cards before playing.
            </p>
            <h3 className="mt-2 text-base font-bold text-white">House Rules</h3>
            <p>
              You can change the way the game is played in a variety of ways. While setting up
              the game, choose as many house rules as you would like to use.
            </p>
            <ul className="flex flex-col gap-3">
              <li>
                <p className="font-bold text-white">The Crackdown</p>
                <p>
                  At any time, players may trade in Boner Points to discard their hand and draw
                  a new one.
                </p>
              </li>
              <li>
                <p className="font-bold text-white">Packing a Blackjack</p>
                <p>
                  Any Black Cards with Pick 2 also get Draw 1, so everyone has more options.
                </p>
              </li>
              <li>
                <p className="font-bold text-white">Retard in Boy&apos;s Room</p>
                <p>
                  Every round, the first White Card in the deck will be played as an answer.
                  This play belongs to an AI player named Retard in Boy&apos;s Room, and if he
                  wins the game, all players go home in a state of everlasting shame.
                </p>
              </li>
              <li>
                <p className="font-bold text-white">Comedy Writer</p>
                <p>Add blank White Cards where players can write custom responses.</p>
              </li>
              <li>
                <p className="font-bold text-white">Never Have I Ever</p>
                <p>
                  At any time, a player may discard cards that they don&apos;t understand;
                  however, they must confess their ignorance, and the card is shared publicly.
                </p>
              </li>
              <li>
                <p className="font-bold text-white">Happy Ending</p>
                <p>
                  When the game ends, the final round is a &apos;Make a Haiku&apos; Black Card.
                </p>
              </li>
              <li>
                <p className="font-bold text-white">Head Hobo&apos;s Pick</p>
                <p>The winner of each round becomes the Head Hobo for the next round.</p>
              </li>
            </ul>
          </div>
        </section>
      ) : null}

      <footer className="text-center text-xs text-purple-400">
        {version !== null ? (
          <p>
            Server version <span className="font-mono">{version}</span> · connected through
            the dev proxy
          </p>
        ) : (
          <p>Could not reach the game server — is it running on localhost:8081?</p>
        )}
      </footer>
    </div>
  );
}

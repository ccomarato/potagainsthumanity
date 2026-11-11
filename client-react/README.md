# PoT Against Humanity — React client (Phase 0 scaffold)

A modern, mobile-first web client for the existing PoT Against Humanity
game server. Vite + React + TypeScript + Tailwind CSS. No Elm, no
Webpack, no Polymer, no Chromecast. English only.

**Phase 0 scope:** create/join a game over REST, open one WebSocket
per game, authenticate, and render the server's `Sync` payload
read-only. No game actions yet (Submit / Reveal / Judge arrive in
Phase 1). The TypeScript server is untouched — this client only speaks
the protocol the server already speaks (see `REACT_PLAN.md`).

**Also in, ahead of schedule (Phase 2 slice):** the owner's game
settings — Decks / Rules / Time limits / Privacy tabs in the game
screen — and the tabbed start screen (New / Join / Find / About).
Both are live and smoke-tested against the real server; see below.

## Drop-in

```bash
# From the repo root (beside client/ and server/):
cp -r client-react /path/to/potagainsthumanity/
cd /path/to/potagainsthumanity/client-react
git checkout -b react-client        # keep it on a branch until it replaces client/
git add client-react && git commit -m "Phase 0 React scaffold (Sync proof)"

npm install
npm run dev                          # http://localhost:5173
```

The dev server proxies `/api` — REST **and** the WebSocket upgrade —
to the game server on `localhost:8081`, so the client talks to your
real server with zero config. Point it somewhere else with:

```bash
VITE_API_TARGET=http://localhost:8081 npm run dev
```

To point the scaffold at the **live** server instead of a local one,
run the game server somewhere reachable and set `VITE_API_TARGET` to
it, e.g. `VITE_API_TARGET=https://pot.webswerve.com npm run dev`.
(Your live server is already on 0.1.5; the scaffold speaks the same
protocol. The token you get from create/join is per-game, so one game's
token cannot join another game.)

Production build:

```bash
npm run build     # typecheck + Vite build -> dist/
npm run preview   # serve the built output locally (no /api proxy — use nginx, see below)
```

The production shape mirrors the old client: serve `dist/` from nginx
on port 8080, proxying `/api` (with WebSocket upgrade headers) to the
server on 8081. Only the client service changes; the server service
is untouched.

## What it does

- **Start screen** — New / Join / Find / About tabs, like the old
  client. One tab is visible at a time on every screen size: a
  portrait single-column panel on mobile, a wider panel on a PC.
  New: create a game (name only; server defaults apply) with a
  "List as a public game" checkbox (off by default — games are
  private unless you opt in). The server takes no `public` flag at
  creation, so a ticked box is applied right after you enter: the
  owner sends a `Configure` action (an RFC 6902 patch with a version
  test) flipping `/public` to `true` — an `add`, since the censored
  config omits the key entirely while a game is private. Find
  refreshes the public list whenever the tab opens. About explains
  the game and credits the MassiveDecks fork.
- **Game settings (owner only)** — Decks / Rules / Time limits /
  Privacy tabs in the game screen. Each tab edits a local draft of
  the current config; "Apply changes" diffs it against the latest
  Sync and sends one `Configure` patch (version test first). Decks:
  add/remove built-in decks (from `GET /api/sources`; new games
  start with the PoT Season 1 deck only). Rules: hand size (3–50),
  score limit, and the house rules (Head Hobo's Pick, Retard in Boy's Room, Packing
  a Blackjack, The Crackdown, Happy Ending, Head Hobo Choices, Comedy Writer, Never
  Have I Ever) with their parameters. Time limits: Soft/Hard mode
  and per-stage durations + grace (starting is a plain number of
  seconds; revealing can be switched off, which skips the phase).
  Privacy: public listing, audience mode, game password (set /
  change / remove). A rejected patch shows the server's reason under
  the Apply bar and leaves the draft untouched. Non-owners see the
  same settings as a read-only list.
- **Game view** — renders the latest `Sync` read-only: players
  (name, role, privilege, presence, connection, score, likes, Head Hobo),
  game settings (hand size, score limit, time-limit mode, house
  rules, decks, visibility), current stage with its call card and
  plays, round history, and your **own** private state (your hand,
  your submitted play, your likes, and — if you are the Head Hobo during
  Starting — the calls to pick from). A collapsible debug block shows
  the raw *public* game state.
- **Stage timer** — derived from the server's `gameTime` anchor in
  the Sync, never from the device clock alone.
- **Reconnect** — backoff starting at 0.5s, doubling to a 60s cap,
  reset on a successful Sync. A "Re-sync" button forces a fresh Sync.
- **Live events feed** — non-Sync events are listed by name as they
  arrive (Phase 0 does not apply them yet; each one triggers a
  re-sync — see below).

## Protocol notes (verified against the server source)

- REST: `POST /api/games` (body `{name, owner:{name}}`, returns the
  owner JWT in the body and the game code in the `Location` header),
  `POST /api/games/:gameCode` (body `{name, password?}`, returns a
  JWT; names must be unique in the game), `GET /api/games` (public
  game summaries), `GET /api/version`, `GET /api/sources` (deck
  sources the server offers; built-in decks carry id/name/author/
  language).
- **Configure patch rules** (verified live): the patch is an RFC
  6902 array with a `test` on `/version` (string) first. `public`
  and `audienceMode` are only present in the censored config when
  true, so turning one on is an `add`, turning it off a `replace`
  (a `replace` on a missing key is rejected: "MissingError: Value
  required at path: /public"). Decks may only be `add`ed or
  `remove`d — `replace` on a deck is rejected ("Illegal action for
  decks.") — and an added deck must be just `{ source }`; the
  server resolves the summary itself and rejects entries carrying
  `summary` or `failure`. A rejected action arrives with **no**
  `event` field, as `{ error: "InvalidAction", reason: ... }`.
- WebSocket: `ws(s)://<host>/api/games/:gameCode`. The first message
  **must** be `{"action":"Authenticate","token":<jwt>}`; the server
  replies with a `Sync` event.
- **Re-sync means a new socket, not a second Authenticate.** The
  server throws `AlreadyAuthenticatedError` if `Authenticate` is sent
  twice on one connection, so the client closes the socket and
  reconnects for a fresh Sync.
- Sync's private fields (`hand`, `play`, `likeDetail`, `calls`) are
  only ever the receiving user's own data. This client never renders
  another player's hand and never logs Sync payloads (in dev, only
  event *names* are logged).
- The JWT is kept in `sessionStorage`, so a tab refresh keeps you in
  the game; Leave clears it.

## No deck card text in this scaffold

This folder contains no card text from any deck. Call and response
text is only ever rendered as live data from the server you point it
at. Empty states use bracketed placeholders (e.g. `[not revealed yet]`).

## Known Phase 0 limits (Phase 1 work)

- Incremental events are not applied — every non-Sync event triggers
  a re-sync. That is the safety net from the plan, and it is correct
  but chatty in a busy game. Phase 1 applies the events
  (`Joined`, `PlaySubmitted`, `RoundStarted`, …) to local state.
- No game actions yet: no Submit / TakeBack / Reveal / Judge /
  StartGame buttons. The `send()` hook is there for them.
- No service worker / install prompt yet (Phase 3). The manifest and
  PWA plugin come with the mobile layout pass.

## Verify it yourself

```bash
npm run build          # must pass with zero errors
npm run dev            # with the game server running on :8081
```

Then create a game, join it from a second tab (different name), and
watch the Sync view and the live-events feed update. The smoke test
used during development (not shipped) drove the same flow against
the real server: create → duplicate-name 409 → join → Authenticate
→ Sync → join-a-third → `Joined` event → fresh Sync with 3 users
(all 15 checks passed), plus a 20-check config run: public flip via
`add` (listed) and back via `replace` (unlisted), hand-size /
playing-duration / house-rule patch, deck add + remove with summary
resolution, rejected deck `replace`, rejected stale version test.
All 20 checks passed.

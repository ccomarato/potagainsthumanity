/**
 * Types for the wire protocol spoken by the existing TypeScript game
 * server. Transcribed from server/src/ts — the server is the source
 * of truth; this file only describes what it already sends.
 *
 * Privacy rule (from REACT_PLAN.md): the server only ever sends YOUR
 * own hand in a Sync. This client must never render another player's
 * hand, and must never log Sync payloads.
 */

// ---------------------------------------------------------------- users

export type UserId = string;

export type Privilege = "Privileged" | "Unprivileged";
export type Presence = "Joined" | "Left";
export type Connection = "Connected" | "Disconnected";
export type Role = "Spectator" | "Player";
export type Control = "Human" | "Computer";

/** A user, as every client in the game sees them. */
export interface PublicUser {
  name: string;
  presence: Presence;
  connection: Connection;
  privilege: Privilege;
  control: Control;
  role: Role;
}

// ---------------------------------------------------------------- cards

export type CardId = string;

export interface CardSource {
  source: string;
  [key: string]: unknown;
}

export type CardStyle = "Em" | "Strong";

/** An empty slot on a call card. */
export interface Slot {
  index?: number;
  transform?: "UpperCase" | "Capitalize";
  style?: CardStyle;
}

export interface StyledText {
  text: string;
  style?: CardStyle;
}

/** One piece of a call card: plain text, styled text, or a slot. */
export type CallPart = string | StyledText | Slot;

export interface CallCard {
  id: CardId;
  source: CardSource;
  /** Text and slots. Render slots as blank answer spaces. */
  parts: CallPart[][];
}

export interface ResponseCard {
  id: CardId;
  source: CardSource;
  text: string;
}

/** Your hand: response cards only. Only ever your own hand. */
export type Hand = ResponseCard[];

// ---------------------------------------------------------------- rounds

export type Stage = "Starting" | "Playing" | "Revealing" | "Judging" | "Complete";

interface RoundBase {
  stage: Stage;
  id: string;
  czar: UserId;
  players: UserId[];
  /** Server timestamp (ms since epoch) when this stage started. */
  startedAt: number;
}

export interface StartingRound extends RoundBase {
  stage: "Starting";
  timedOut?: boolean;
}

export interface PlayingRound extends RoundBase {
  stage: "Playing";
  call: CallCard;
  /** Ids of players who have submitted a play. */
  played: UserId[];
  timedOut?: boolean;
}

export interface RevealingRound extends RoundBase {
  stage: "Revealing";
  call: CallCard;
  plays: { id: string; play?: ResponseCard[]; likes?: number }[];
  timedOut?: boolean;
}

export interface JudgingRound extends RoundBase {
  stage: "Judging";
  call: CallCard;
  plays: { id: string; play: ResponseCard[]; likes?: number }[];
  timedOut?: boolean;
}

export interface CompleteRound extends RoundBase {
  stage: "Complete";
  call: CallCard;
  winner: UserId;
  plays: { [id: string]: { play: ResponseCard[]; playedBy: UserId; likes?: number } };
  playOrder: string[];
}

export type PublicRound =
  | StartingRound
  | PlayingRound
  | RevealingRound
  | JudgingRound
  | CompleteRound;

export interface LikeDetail {
  liked: string[];
  played?: string;
}

// ---------------------------------------------------------------- game

export type PlayerPresence = "Active" | "Away";

export interface PublicPlayer {
  score: number;
  likes: number;
  presence: PlayerPresence;
}

export interface StageLimits {
  duration?: number;
  /** Seconds of grace after the stage ends before the server acts. */
  after: number;
}

export interface Stages {
  timeLimitMode: "Hard" | "Soft";
  /** Head Hobo call-picking phase (only with the Head Hobo Choices house rule). */
  starting?: number;
  playing: StageLimits;
  revealing?: StageLimits;
  judging: StageLimits;
}

export interface PublicRules {
  handSize: number;
  scoreLimit?: number;
  houseRules: { [key: string]: unknown };
  stages: Stages;
}

export interface PublicGame {
  round: PublicRound;
  history: CompleteRound[];
  playerOrder: UserId[];
  players: { [id: string]: PublicPlayer };
  rules: PublicRules;
  winner?: string[];
  paused?: boolean;
}

// ---------------------------------------------------------------- game

export interface ConfiguredDeckSource {
  source: unknown;
  [key: string]: unknown;
}

export interface PublicConfig {
  version: string;
  name: string;
  rules: PublicRules;
  public?: boolean;
  password?: string;
  audienceMode?: boolean;
  decks: ConfiguredDeckSource[];
}

/** A game with only the state all users may see. */
export interface PublicGame {
  users: { [id: string]: PublicUser };
  owner: UserId;
  config: PublicConfig;
  game?: PublicGame;
  errors?: { error: string; [key: string]: unknown }[];
}

export type GameState = "Playing" | "SettingUp";

export interface GameSummary {
  name: string;
  gameCode: string;
  state: GameState;
  users: { players: number; spectators: number };
  password?: boolean;
}

// ---------------------------------------------------------------- events

/**
 * The full state push the server sends right after Authenticate.
 * `hand`, `play`, `likeDetail` and `calls` are private to the
 * receiving user and are only present when they apply:
 * - hand: your own hand (never anyone else's).
 * - play: ids of the cards you already submitted this round.
 * - likeDetail: which plays you liked / your own play, during
 *   Revealing/Judging.
 * - calls: the calls to pick from, only if you are the Head Hobo during
 *   Starting.
 * `gameTime` is the server clock anchor (ms since epoch) — timers
 * must be derived from it, never from the local clock alone.
 */
export interface Sync {
  event: "Sync";
  state: PublicGame;
  hand?: Hand;
  calls?: CallCard[];
  play?: CardId[];
  likeDetail?: LikeDetail;
  gameTime: number;
}

export type ServerEvent = Sync | { event: string; [key: string]: unknown };

// ---------------------------------------------------------------- REST

export interface CreateGameBody {
  name: string;
  owner: { name: string; password?: string };
}

export interface JoinGameBody {
  name: string;
  password?: string;
}

/**
 * REST client for the game server. All calls go through the Vite dev
 * proxy (/api -> the game server on localhost:8081) in development,
 * and same-origin /api in production. No auth beyond the JWT a
 * create/join call returns — that token is the whole auth story.
 */
import type { CreateGameBody, JoinGameBody, GameSummary } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.error) detail = body.error;
      else if (body.message) detail = body.message;
    } catch {
      // Not JSON — keep the HTTP status text.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** GET /api/version — the version baked into the server image. */
export async function getVersion(): Promise<string> {
  return request<string>("/api/version");
}

/** GET /api/games — summaries of public games. */
export async function listGames(): Promise<GameSummary[]> {
  return request<GameSummary[]>("/api/games");
}

export interface BuiltInDeckInfo {
  id: string;
  name: string;
  author: string;
  language: string;
  translator?: string;
}

export interface SourcesInfo {
  /** Built-in decks (the only kind v1 lets you add). */
  builtIn: { decks: BuiltInDeckInfo[] };
  manyDecks?: unknown;
  jsonAgainstHumanity?: unknown;
}

/** GET /api/sources — the deck sources the server offers. */
export async function getSources(): Promise<SourcesInfo> {
  return request<SourcesInfo>("/api/sources");
}

export interface CreatedGame {
  /** JWT for the game owner. */
  token: string;
  /** Game code, taken from the Location response header. */
  gameCode: string;
}

/**
 * POST /api/games — create a game. The server applies its own
 * defaults (hand size, score limit, house rules, decks); the body
 * only names the game and its owner.
 */
export async function createGame(body: CreateGameBody): Promise<CreatedGame> {
  const res = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) detail = data.error;
    } catch {
      // Not JSON — keep the HTTP status text.
    }
    throw new Error(detail);
  }
  const token = (await res.json()) as string;
  const location = res.headers.get("Location") ?? "";
  const gameCode = location.split("/").filter(Boolean).pop() ?? "";
  if (!gameCode) {
    throw new Error("Server did not return a game code for the new game.");
  }
  return { token, gameCode };
}

/**
 * POST /api/games/:gameCode — join a game. Returns a JWT.
 * Names must be unique in the game; the server rejects duplicates.
 * In audience-mode games joiners become spectators, else players.
 */
export async function joinGame(
  gameCode: string,
  body: JoinGameBody,
): Promise<string> {
  return request<string>(`/api/games/${encodeURIComponent(gameCode)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

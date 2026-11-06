/**
 * Game configuration editing for the React client.
 *
 * The server has no "edit config" REST call: every change goes
 * through the `Configure` WebSocket action, which takes an RFC 6902
 * JSON Patch against the *censored* public config, with a version
 * test first so a stale edit is rejected instead of overwriting
 * someone else's change. This module owns the two halves of that:
 *
 *   1. `draftFromConfig` — turn the server's censored config into an
 *      editable draft (plain values, no server quirks).
 *   2. `buildConfigurePatch` — diff a draft against the censored
 *      config and produce the patch, version test included.
 *
 * Server quirks the diff has to respect (all verified against
 * server/src/ts — see the notes in the code):
 * - The censored config only includes `public`, `audienceMode` and
 *   `password` when they are set/true, so flipping a game public is
 *   an `add` (the key does not exist yet), not a `replace` — a
 *   `replace` on a missing key is rejected with
 *   "MissingError: Value required at path: /public".
 * - `password` in the censored config is the actual password string
 *   (an upstream leak, not something this client relies on or
 *   displays). The draft tracks only whether one is set, never its
 *   value.
 * - Decks may only be `add`ed or `remove`d, and an added deck must
 *   be just `{ source }` — the server resolves the summary itself
 *   and rejects an entry carrying `summary` or `failure`.
 * - `starting` in stages is a plain number of seconds (no `after`);
 *   `revealing` is optional — when absent the reveal phase is
 *   skipped.
 * - `rando` is absent from the censored config when its number is 0.
 */
import type { ConfiguredDeckSource, PublicConfig } from "./types";

export type PatchOp = {
  op: "test" | "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

// ---------------------------------------------------------------- draft

export interface DraftStage {
  duration: number | null;
  after: number;
}

export interface DraftConfig {
  decks: ConfiguredDeckSource[];
  handSize: number;
  scoreLimit: number | null;
  winnersPick: boolean;
  rando: number;
  packingHeat: boolean;
  reboot: number | null;
  happyEnding: boolean;
  czarChoices: { numberOfChoices: number; custom: boolean } | null;
  comedyWriter: { number: number; exclusive: boolean } | null;
  neverHaveIEver: boolean;
  timeLimitMode: "Hard" | "Soft";
  starting: number | null;
  playing: DraftStage;
  revealing: DraftStage | null;
  judging: DraftStage;
  public: boolean;
  hasPassword: boolean;
  passwordMode: "unchanged" | "set" | "remove";
  passwordValue: string;
  audienceMode: boolean;
}

type AnyRecord = { [key: string]: unknown };

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function ruleOf(config: PublicConfig, key: string): AnyRecord | null {
  const v = config.rules.houseRules[key];
  return isRecord(v) ? v : null;
}

function stageOf(
  stage: { duration?: number; after: number } | undefined,
): DraftStage | null {
  if (!stage) return null;
  return { duration: stage.duration ?? null, after: stage.after };
}

export function draftFromConfig(config: PublicConfig): DraftConfig {
  const hr = config.rules.houseRules;
  const stages = config.rules.stages;
  const rando = ruleOf(config, "rando");
  const reboot = ruleOf(config, "reboot");
  const czar = ruleOf(config, "czarChoices");
  const comedy = ruleOf(config, "comedyWriter");
  return {
    decks: config.decks.map((d) => ({ ...d })),
    handSize: config.rules.handSize,
    scoreLimit: config.rules.scoreLimit ?? null,
    winnersPick: hr.winnersPick !== undefined,
    rando: num(rando?.number) ?? 0,
    packingHeat: hr.packingHeat !== undefined,
    reboot: num(reboot?.cost),
    happyEnding: hr.happyEnding !== undefined,
    czarChoices:
      czar !== null
        ? {
            numberOfChoices: num(czar.numberOfChoices) ?? 3,
            custom: czar.custom === true,
          }
        : null,
    comedyWriter:
      comedy !== null
        ? {
            number: num(comedy.number) ?? 100,
            exclusive: comedy.exclusive === true,
          }
        : null,
    neverHaveIEver: hr.neverHaveIEver !== undefined,
    timeLimitMode: stages.timeLimitMode,
    starting: stages.starting ?? null,
    playing: stageOf(stages.playing) ?? { duration: null, after: 2 },
    revealing: stageOf(stages.revealing),
    judging: stageOf(stages.judging) ?? { duration: null, after: 2 },
    public: config.public === true,
    hasPassword: config.password !== undefined,
    passwordMode: "unchanged",
    passwordValue: "",
    audienceMode: config.audienceMode === true,
  };
}

// ---------------------------------------------------------------- diff

/** Label for a deck entry in the UI: its summary name, else its id. */
export function deckLabel(entry: ConfiguredDeckSource): string {
  const source = isRecord(entry.source) ? entry.source : {};
  const summary = isRecord(entry.summary) ? entry.summary : null;
  const details = summary && isRecord(summary.details) ? summary.details : null;
  if (typeof details?.name === "string") return details.name;
  if (typeof source.id === "string") return source.id;
  return JSON.stringify(entry.source);
}

/** True for a built-in deck (the only kind v1 lets you add/remove). */
export function isBuiltIn(entry: ConfiguredDeckSource): boolean {
  const source = isRecord(entry.source) ? entry.source : {};
  return source.source === "BuiltIn" && typeof source.id === "string";
}

function optionalOp(
  ops: PatchOp[],
  path: string,
  current: number | null | undefined,
  next: number | null,
): void {
  if (current === next) return;
  if (current === undefined || current === null) {
    if (next !== null) ops.push({ op: "add", path, value: next });
  } else if (next === null) {
    ops.push({ op: "remove", path });
  } else {
    ops.push({ op: "replace", path, value: next });
  }
}

function toggleOp(
  ops: PatchOp[],
  path: string,
  current: boolean,
  next: boolean,
): void {
  if (current === next) return;
  // `public` and `audienceMode` are only present in the censored
  // config when true, so turning one on is an `add`, off a `replace`.
  if (next) ops.push({ op: "add", path, value: true });
  else ops.push({ op: "replace", path, value: false });
}

function ruleToggleOp(
  ops: PatchOp[],
  path: string,
  current: boolean,
  next: boolean,
): void {
  if (current === next) return;
  if (next) ops.push({ op: "add", path, value: {} });
  else ops.push({ op: "remove", path });
}

function ruleValueOp(
  ops: PatchOp[],
  path: string,
  current: unknown,
  next: unknown,
): void {
  const currentJson = current === undefined ? undefined : JSON.stringify(current);
  const nextJson = next === undefined ? undefined : JSON.stringify(next);
  if (currentJson === nextJson) return;
  if (current === undefined) ops.push({ op: "add", path, value: next });
  else if (next === undefined) ops.push({ op: "remove", path });
  else ops.push({ op: "replace", path, value: next });
}

function stageOps(
  ops: PatchOp[],
  base: string,
  current: { duration?: number; after: number } | undefined,
  next: DraftStage | null,
): void {
  if (current === undefined && next === null) return;
  if (current === undefined && next !== null) {
    const value: AnyRecord = { after: next.after };
    if (next.duration !== null) value.duration = next.duration;
    ops.push({ op: "add", path: base, value });
    return;
  }
  if (current !== undefined && next === null) {
    ops.push({ op: "remove", path: base });
    return;
  }
  // Both present: duration is optional, `after` is always there.
  optionalOp(ops, `${base}/duration`, current?.duration, next?.duration ?? null);
  if (current?.after !== next?.after) {
    ops.push({ op: "replace", path: `${base}/after`, value: next?.after });
  }
}

/**
 * Diff a draft against the censored config and return the full
 * `Configure` change array (version test first), or null when
 * nothing changed.
 */
export function buildConfigurePatch(
  config: PublicConfig,
  draft: DraftConfig,
): PatchOp[] | null {
  const ops: PatchOp[] = [];

  // Decks: removals by index (descending, so indices stay valid),
  // then additions appended at the end. Added entries carry only
  // `{ source }` — the server resolves the summary itself.
  const currentSources = config.decks.map((d) => JSON.stringify(d.source));
  const draftSources = draft.decks.map((d) => JSON.stringify(d.source));
  const removed: number[] = [];
  currentSources.forEach((s, i) => {
    if (!draftSources.includes(s)) removed.push(i);
  });
  removed
    .sort((a, b) => b - a)
    .forEach((i) => ops.push({ op: "remove", path: `/decks/${i}` }));
  draft.decks.forEach((d) => {
    if (!currentSources.includes(JSON.stringify(d.source))) {
      ops.push({ op: "add", path: "/decks/-", value: { source: d.source } });
    }
  });

  // Rules.
  if (draft.handSize !== config.rules.handSize) {
    ops.push({ op: "replace", path: "/rules/handSize", value: draft.handSize });
  }
  optionalOp(ops, "/rules/scoreLimit", config.rules.scoreLimit, draft.scoreLimit);

  const hr = config.rules.houseRules;
  ruleToggleOp(ops, "/rules/houseRules/winnersPick", hr.winnersPick !== undefined, draft.winnersPick);
  ruleToggleOp(ops, "/rules/houseRules/packingHeat", hr.packingHeat !== undefined, draft.packingHeat);
  ruleToggleOp(ops, "/rules/houseRules/happyEnding", hr.happyEnding !== undefined, draft.happyEnding);
  ruleToggleOp(ops, "/rules/houseRules/neverHaveIEver", hr.neverHaveIEver !== undefined, draft.neverHaveIEver);

  const currentRando = num(ruleOf(config, "rando")?.number) ?? 0;
  ruleValueOp(
    ops,
    "/rules/houseRules/rando",
    currentRando === 0 ? undefined : { number: currentRando },
    draft.rando === 0 ? undefined : { number: draft.rando },
  );
  const currentReboot = num(ruleOf(config, "reboot")?.cost);
  ruleValueOp(
    ops,
    "/rules/houseRules/reboot",
    currentReboot === null ? undefined : { cost: currentReboot },
    draft.reboot === null ? undefined : { cost: draft.reboot },
  );
  const currentCzar = ruleOf(config, "czarChoices");
  const currentCzarValue =
    currentCzar === null
      ? undefined
      : {
          numberOfChoices: num(currentCzar.numberOfChoices) ?? 3,
          ...(currentCzar.custom === true ? { custom: true } : {}),
        };
  const nextCzarValue =
    draft.czarChoices === null
      ? undefined
      : {
          numberOfChoices: draft.czarChoices.numberOfChoices,
          ...(draft.czarChoices.custom ? { custom: true } : {}),
        };
  ruleValueOp(ops, "/rules/houseRules/czarChoices", currentCzarValue, nextCzarValue);
  const currentComedy = ruleOf(config, "comedyWriter");
  const currentComedyValue =
    currentComedy === null
      ? undefined
      : {
          number: num(currentComedy.number) ?? 100,
          exclusive: currentComedy.exclusive === true,
        };
  const nextComedyValue =
    draft.comedyWriter === null
      ? undefined
      : {
          number: draft.comedyWriter.number,
          exclusive: draft.comedyWriter.exclusive,
        };
  ruleValueOp(ops, "/rules/houseRules/comedyWriter", currentComedyValue, nextComedyValue);

  // Time limits.
  const stages = config.rules.stages;
  if (draft.timeLimitMode !== stages.timeLimitMode) {
    ops.push({
      op: "replace",
      path: "/rules/stages/timeLimitMode",
      value: draft.timeLimitMode,
    });
  }
  optionalOp(ops, "/rules/stages/starting", stages.starting, draft.starting);
  stageOps(ops, "/rules/stages/playing", stages.playing, draft.playing);
  stageOps(ops, "/rules/stages/revealing", stages.revealing, draft.revealing);
  stageOps(ops, "/rules/stages/judging", stages.judging, draft.judging);

  // Privacy.
  toggleOp(ops, "/public", config.public === true, draft.public);
  toggleOp(ops, "/audienceMode", config.audienceMode === true, draft.audienceMode);
  if (draft.passwordMode === "set" && draft.passwordValue !== "") {
    if (draft.hasPassword) {
      ops.push({ op: "replace", path: "/password", value: draft.passwordValue });
    } else {
      ops.push({ op: "add", path: "/password", value: draft.passwordValue });
    }
  } else if (draft.passwordMode === "remove" && draft.hasPassword) {
    ops.push({ op: "remove", path: "/password" });
  }

  if (ops.length === 0) return null;
  return [
    { op: "test", path: "/version", value: config.version },
    ...ops,
  ];
}

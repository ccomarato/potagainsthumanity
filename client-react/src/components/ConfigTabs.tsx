/**
 * Game settings for the owner: the four tabs from the old client —
 * Decks, Rules, Time limits, Privacy.
 *
 * Every tab edits a local draft of the censored config; nothing is
 * sent until "Apply changes". Applying diffs the draft against the
 * latest Sync and sends one `Configure` action (an RFC 6902 patch
 * with a version test — see src/config.ts). If the server rejects
 * the patch (stale version, invalid value), the rejection reason
 * surfaces under the Apply bar and the draft is left untouched so
 * the owner can fix it and try again.
 *
 * Only the owner sees this panel (ConfigTabs is rendered for the
 * owner only); everyone else gets the read-only settings list.
 */
import { useEffect, useState } from "react";
import { getSources, type BuiltInDeckInfo } from "../api";
import {
  buildConfigurePatch,
  deckLabel,
  draftFromConfig,
  isBuiltIn,
  type DraftConfig,
  type DraftStage,
} from "../config";
import type { PublicConfig } from "../types";

type Tab = "decks" | "rules" | "stages" | "privacy";

const TABS: { id: Tab; label: string }[] = [
  { id: "decks", label: "Decks" },
  { id: "rules", label: "Rules" },
  { id: "stages", label: "Time limits" },
  { id: "privacy", label: "Privacy" },
];

function fieldClass(extra = ""): string {
  return `w-full rounded-xl border border-purple-700 bg-purple-950/60 px-3 py-2 text-white placeholder:text-purple-400 focus:border-yellow-300 focus:outline-none ${extra}`;
}

function CheckRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-purple-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-yellow-300"
      />
      <span>
        {label}
        {desc ? <span className="block text-xs text-purple-400">{desc}</span> : null}
      </span>
    </label>
  );
}

/**
 * Number input that keeps its own text while typing and commits a
 * clamped integer (or null for "no limit") on blur. Without this,
 * clearing a controlled number field is impossible.
 */
function NumberField({
  label,
  value,
  min,
  max,
  hint,
  onCommit,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  hint?: string;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setText(value === null ? "" : String(value));
  }, [value]);
  const commit = () => {
    if (text.trim() === "") {
      onCommit(null);
      return;
    }
    const n = Math.floor(Number(text));
    if (!Number.isFinite(n)) {
      setText(value === null ? "" : String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    onCommit(clamped);
    setText(String(clamped));
  };
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-purple-200">{label}</span>
      <input
        type="number"
        className={fieldClass()}
        value={text}
        min={min}
        max={max}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {hint ? <span className="mt-1 block text-xs text-purple-400">{hint}</span> : null}
    </label>
  );
}

function StageFields({
  title,
  stage,
  onChange,
}: {
  title: string;
  stage: DraftStage;
  onChange: (s: DraftStage) => void;
}) {
  return (
    <div className="rounded-xl bg-purple-950/60 p-3">
      <p className="mb-2 text-sm font-bold text-white">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Time limit (seconds)"
          value={stage.duration}
          min={0}
          max={900}
          hint="Blank = no limit."
          onCommit={(duration) => onChange({ ...stage, duration })}
        />
        <NumberField
          label="Grace after (seconds)"
          value={stage.after}
          min={0}
          max={900}
          hint="Time to look around before the server acts."
          onCommit={(after) => onChange({ ...stage, after: after ?? 0 })}
        />
      </div>
    </div>
  );
}

export function ConfigTabs({
  config,
  send,
  lastError,
}: {
  config: PublicConfig;
  send: (action: Record<string, unknown>) => void;
  lastError: string | null;
}) {
  const [tab, setTab] = useState<Tab>("decks");
  const [draft, setDraft] = useState<DraftConfig>(() => draftFromConfig(config));
  const [dirty, setDirty] = useState(false);
  const [baseVersion, setBaseVersion] = useState(config.version);
  const [expectedVersion, setExpectedVersion] = useState<string | null>(null);
  const [available, setAvailable] = useState<BuiltInDeckInfo[]>([]);
  const [availableError, setAvailableError] = useState(false);
  const [addDeckId, setAddDeckId] = useState("");

  useEffect(() => {
    getSources()
      .then((s) => setAvailable(s.builtIn.decks))
      .catch(() => setAvailableError(true));
  }, []);

  // The draft follows the server config: refresh it whenever a new
  // Sync arrives with a different version and there are no unsaved
  // edits, or when the version we just applied shows up.
  useEffect(() => {
    if (expectedVersion !== null && config.version === expectedVersion) {
      setDraft(draftFromConfig(config));
      setDirty(false);
      setBaseVersion(config.version);
      setExpectedVersion(null);
    } else if (!dirty && config.version !== baseVersion) {
      setDraft(draftFromConfig(config));
      setBaseVersion(config.version);
    }
  }, [config, dirty, baseVersion, expectedVersion]);

  const update = (patch: Partial<DraftConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const apply = () => {
    const change = buildConfigurePatch(config, draft);
    if (!change) return;
    setExpectedVersion(String(Number(config.version) + 1));
    send({ action: "Configure", change });
  };

  const reset = () => {
    setDraft(draftFromConfig(config));
    setDirty(false);
    setBaseVersion(config.version);
    setExpectedVersion(null);
  };

  const addable = available.filter(
    (d) => !draft.decks.some((e) => deckLabel(e) === d.name) && !draft.decks.some((e) => {
      const s = e.source as { source?: string; id?: string };
      return s.source === "BuiltIn" && s.id === d.id;
    }),
  );

  return (
    <section className="rounded-2xl bg-purple-900/50 p-5 shadow-lg">
      <h2 className="mb-3 text-lg font-bold text-white">Game settings</h2>

      <div className="mb-4 flex gap-1 rounded-full bg-purple-950/70 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-bold sm:text-sm ${
              tab === t.id
                ? "bg-yellow-300 text-purple-950"
                : "text-purple-200 hover:bg-purple-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "decks" ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-purple-300">
            Decks in this game. Adding a deck loads its cards from the server; removing one
            takes it out of future rounds.
          </p>
          <ul className="flex flex-col gap-2">
            {draft.decks.map((entry, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl bg-purple-950/60 px-3 py-2"
              >
                <span className="min-w-0 text-sm font-bold text-white">
                  {deckLabel(entry)}
                  {!isBuiltIn(entry) ? (
                    <span className="block text-xs font-normal text-purple-400">
                      External deck — remove it from the server config, not here.
                    </span>
                  ) : null}
                </span>
                {isBuiltIn(entry) ? (
                  <button
                    type="button"
                    onClick={() =>
                      update({ decks: draft.decks.filter((_, j) => j !== i) })
                    }
                    className="shrink-0 rounded-lg border border-red-400/60 px-2 py-1 text-xs text-red-200 hover:bg-red-950"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {availableError ? (
            <p className="text-sm text-red-300">
              Could not load the deck list from the server — adding decks is unavailable right
              now.
            </p>
          ) : addable.length > 0 ? (
            <div className="flex gap-2">
              <select
                value={addDeckId}
                onChange={(e) => setAddDeckId(e.target.value)}
                className={fieldClass()}
                aria-label="Deck to add"
              >
                <option value="">Add a deck…</option>
                {addable.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.language})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addDeckId}
                onClick={() => {
                  if (!addDeckId) return;
                  update({
                    decks: [...draft.decks, { source: { source: "BuiltIn", id: addDeckId } }],
                  });
                  setAddDeckId("");
                }}
                className="shrink-0 rounded-xl bg-yellow-300 px-4 py-2 font-bold text-purple-950 hover:bg-yellow-200 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ) : (
            <p className="text-sm text-purple-300">All available decks are already in.</p>
          )}
          <p className="text-xs text-purple-400">
            Custom decks and ManyDecks sources arrive in a later phase — built-in decks only
            for now.
          </p>
        </div>
      ) : null}

      {tab === "rules" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Hand size"
              value={draft.handSize}
              min={3}
              max={50}
              onCommit={(v) => update({ handSize: v ?? 10 })}
            />
            <NumberField
              label="Score limit"
              value={draft.scoreLimit}
              min={1}
              max={10000}
              hint="Blank = no limit, the game goes on."
              onCommit={(v) => update({ scoreLimit: v })}
            />
          </div>
          <CheckRow
            label="Retard in Boy's Room"
            desc="Every round, the first White Card in the deck will be played as an answer. This play belongs to an AI player named Retard in Boy's Room, and if he wins the game, all players go home in a state of everlasting shame."
            checked={draft.rando > 0}
            onChange={(v) => update({ rando: v ? 1 : 0 })}
          />
          {draft.rando > 0 ? (
            <div className="pl-6">
              <NumberField
                label="AI players"
                value={draft.rando}
                min={1}
                max={10}
                onCommit={(v) => update({ rando: v ?? 1 })}
              />
            </div>
          ) : null}
          <CheckRow
            label="Packing a Blackjack"
            desc="Any Black Cards with Pick 2 also get Draw 1, so everyone has more options."
            checked={draft.packingHeat}
            onChange={(v) => update({ packingHeat: v })}
          />
          <CheckRow
            label="The Crackdown"
            desc="At any time, players may trade in Boner Points to discard their hand and draw a new one."
            checked={draft.reboot !== null}
            onChange={(v) => update({ reboot: v ? 1 : null })}
          />
          {draft.reboot !== null ? (
            <div className="pl-6">
              <NumberField
                label="Reboot cost (Boner Points)"
                value={draft.reboot}
                min={1}
                max={50}
                onCommit={(v) => update({ reboot: v ?? 1 })}
              />
            </div>
          ) : null}
          <CheckRow
            label="Comedy Writer"
            desc="Add blank White Cards where players can write custom responses."
            checked={draft.comedyWriter !== null}
            onChange={(v) =>
              update({ comedyWriter: v ? { number: 100, exclusive: false } : null })
            }
          />
          {draft.comedyWriter !== null ? (
            <div className="flex flex-col gap-3 pl-6">
              <NumberField
                label="Blank cards to add"
                value={draft.comedyWriter.number}
                min={1}
                max={99999}
                onCommit={(v) =>
                  update({ comedyWriter: { ...draft.comedyWriter!, number: v ?? 100 } })
                }
              />
              <CheckRow
                label="Blank cards only"
                desc="Only the blank cards are used — no deck answers."
                checked={draft.comedyWriter.exclusive}
                onChange={(v) =>
                  update({ comedyWriter: { ...draft.comedyWriter!, exclusive: v } })
                }
              />
            </div>
          ) : null}
          <CheckRow
            label="Never Have I Ever"
            desc="At any time, a player may discard cards that they don't understand; however, they must confess their ignorance, and the card is shared publicly."
            checked={draft.neverHaveIEver}
            onChange={(v) => update({ neverHaveIEver: v })}
          />
          <CheckRow
            label="Happy Ending"
            desc="When the game ends, the final round is a 'Make a Haiku' Black Card."
            checked={draft.happyEnding}
            onChange={(v) => update({ happyEnding: v })}
          />
          <CheckRow
            label="Head Hobo Choices"
            desc="At the beginning of the round, the Head Hobo draws multiple Black Cards and chooses one of them, and/or has the choice to write their own."
            checked={draft.czarChoices !== null}
            onChange={(v) =>
              update({ czarChoices: v ? { numberOfChoices: 3, custom: false } : null })
            }
          />
          {draft.czarChoices !== null ? (
            <div className="flex flex-col gap-3 pl-6">
              <NumberField
                label="Choices for the Head Hobo"
                value={draft.czarChoices.numberOfChoices}
                min={1}
                max={10}
                onCommit={(v) =>
                  update({
                    czarChoices: {
                      ...draft.czarChoices!,
                      numberOfChoices: v ?? 3,
                    },
                  })
                }
              />
              <CheckRow
                label="Allow a custom call"
                desc="The Head Hobo can write their own call instead of picking one."
                checked={draft.czarChoices.custom}
                onChange={(v) =>
                  update({ czarChoices: { ...draft.czarChoices!, custom: v } })
                }
              />
              <p className="text-xs text-purple-400">See also: Time Limit.</p>
            </div>
          ) : null}
          <CheckRow
            label="Head Hobo's Pick"
            desc="The winner of each round becomes the Head Hobo for the next round."
            checked={draft.winnersPick}
            onChange={(v) => update({ winnersPick: v })}
          />
        </div>
      ) : null}

      {tab === "stages" ? (
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-purple-200">When a time limit runs out</span>
            <select
              value={draft.timeLimitMode}
              onChange={(e) =>
                update({ timeLimitMode: e.target.value as "Hard" | "Soft" })
              }
              className={fieldClass()}
            >
              <option value="Soft">Soft — ready players can set stragglers away</option>
              <option value="Hard">Hard — stragglers are set away automatically</option>
            </select>
          </label>
          <NumberField
            label="Starting — time for the Head Hobo to pick a call (seconds)"
            value={draft.starting}
            min={0}
            max={900}
            hint="Only matters with the Head Hobo Choices rule. Blank = no limit."
            onCommit={(v) => update({ starting: v })}
          />
          <StageFields
            title="Playing"
            stage={draft.playing}
            onChange={(playing) => update({ playing })}
          />
          <div className="rounded-xl bg-purple-950/60 p-3">
            <CheckRow
              label="Revealing stage"
              desc="When off, the reveal phase is skipped."
              checked={draft.revealing !== null}
              onChange={(v) =>
                update({ revealing: v ? { duration: 45, after: 2 } : null })
              }
            />
            {draft.revealing !== null ? (
              <div className="mt-3">
                <StageFields
                  title="Revealing"
                  stage={draft.revealing}
                  onChange={(revealing) => update({ revealing })}
                />
              </div>
            ) : null}
          </div>
          <StageFields
            title="Judging"
            stage={draft.judging}
            onChange={(judging) => update({ judging })}
          />
        </div>
      ) : null}

      {tab === "privacy" ? (
        <div className="flex flex-col gap-3">
          <CheckRow
            label="List as a public game"
            desc="Anyone can find and join it from the Find tab."
            checked={draft.public}
            onChange={(v) => update({ public: v })}
          />
          <CheckRow
            label="Audience mode"
            desc="New joiners watch as spectators instead of playing."
            checked={draft.audienceMode}
            onChange={(v) => update({ audienceMode: v })}
          />
          <div className="rounded-xl bg-purple-950/60 p-3">
            <p className="mb-2 text-sm font-bold text-white">Game password</p>
            {draft.hasPassword && draft.passwordMode !== "remove" ? (
              <p className="mb-2 text-sm text-purple-200">
                A password is set. Joiners need it to get in.
              </p>
            ) : null}
            {draft.passwordMode === "remove" ? (
              <p className="mb-2 text-sm text-yellow-200">
                The password will be removed when you apply.
              </p>
            ) : null}
            <input
              type="password"
              className={fieldClass()}
              placeholder={draft.hasPassword ? "New password (blank = keep it)" : "Set a password"}
              value={draft.passwordValue}
              autoComplete="off"
              onChange={(e) =>
                update({ passwordValue: e.target.value, passwordMode: "set" })
              }
            />
            {draft.hasPassword ? (
              <button
                type="button"
                onClick={() =>
                  update({
                    passwordMode: draft.passwordMode === "remove" ? "unchanged" : "remove",
                    passwordValue: "",
                  })
                }
                className="mt-2 rounded-lg border border-red-400/60 px-2.5 py-1 text-xs text-red-200 hover:bg-red-950"
              >
                {draft.passwordMode === "remove" ? "Keep the password" : "Remove password"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2 border-t border-purple-800 pt-4">
        <button
          type="button"
          disabled={!dirty}
          onClick={apply}
          className="rounded-xl bg-yellow-300 px-4 py-2 font-bold text-purple-950 hover:bg-yellow-200 disabled:opacity-50"
        >
          Apply changes
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={reset}
          className="rounded-xl border border-purple-600 px-4 py-2 text-sm text-purple-200 hover:bg-purple-800 disabled:opacity-50"
        >
          Reset
        </button>
        <p className="text-xs text-purple-400">Changes apply immediately to the live game.</p>
      </div>
      {lastError ? (
        <p role="alert" className="mt-3 rounded-xl border border-red-400/60 bg-red-950/60 px-3 py-2 text-sm text-red-200">
          The server rejected the last change: {lastError}
        </p>
      ) : null}
    </section>
  );
}

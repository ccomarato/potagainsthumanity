import type { CallCard, CallPart } from "../types";

/**
 * Render a call card's parts. Plain text and styled text render as
 * text; slots render as a dashed blank. Slot indices come from the
 * server — a call can reuse a slot index, so the blank shows the
 * slot number when there is more than one distinct slot.
 *
 * The text shown here is live data from the server, not text baked
 * into this client. This scaffold ships no deck card text of its own.
 */
export function CallCardView({ call }: { call: CallCard }) {
  const slotIndices = new Set<number>();
  for (const line of call.parts) {
    for (const part of line) {
      if (typeof part === "object" && !("text" in part) && part.index !== undefined) {
        slotIndices.add(part.index);
      }
    }
  }
  const multiSlot = slotIndices.size > 1;

  const renderPart = (part: CallPart, key: number) => {
    if (typeof part === "string") {
      return <span key={key}>{part}</span>;
    }
    if ("text" in part) {
      return part.style === "Strong" ? (
        <strong key={key}>{part.text}</strong>
      ) : part.style === "Em" ? (
        <em key={key}>{part.text}</em>
      ) : (
        <span key={key}>{part.text}</span>
      );
    }
    // A slot: a dashed blank where a response goes.
    return (
      <span
        key={key}
        className="mx-1 inline-block min-w-16 rounded border-2 border-dashed border-yellow-300 bg-yellow-300/10 px-2 py-0.5 text-center align-middle text-sm font-bold text-yellow-200"
      >
        {multiSlot && part.index !== undefined ? `Blank ${part.index + 1}` : "Blank"}
      </span>
    );
  };

  return (
    <div className="rounded-2xl bg-purple-700 p-4 text-lg font-bold leading-relaxed text-white shadow-lg sm:p-5 sm:text-xl">
      {call.parts.map((line, i) => (
        <p key={i} className="mb-1 last:mb-0">
          {line.map((part, j) => renderPart(part, j))}
        </p>
      ))}
    </div>
  );
}

/** Count the distinct slots on a call (how many responses it takes). */
export function slotCount(call: CallCard): number {
  const indices = new Set<number>();
  let next = 0;
  for (const line of call.parts) {
    for (const part of line) {
      if (typeof part === "object" && !("text" in part)) {
        indices.add(part.index !== undefined ? part.index : next++);
      }
    }
  }
  return indices.size;
}

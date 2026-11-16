import { DateTime } from "luxon";
import { recalledTurns } from "../agent/prefetch";
import type { MemoryChip } from "../types";
import type { Memory } from "./retrieve";

/**
 * The line above an answer that says what the agent remembered: "Recalled your chat from Tue 10 Nov", or
 * "No record found for 3 November". Makes the main feature visible to anyone trying it. Undefined when memory was
 * not consulted (a fresh question), so ordinary answers carry no chip.
 *
 * It names only the chats relevant to the question (the same filter the re-check uses), not every chat that happened
 * to fall on the date: asking about "Monday" on a Monday must not claim to have recalled today's unrelated chats.
 */
export function memoryChip(m: Memory, tz: string, userId: string): MemoryChip | undefined {
  if (!m.attempted) return undefined;

  const turns = recalledTurns(m, userId);
  if (turns.length) {
    const dates = [...new Set(turns.map((t) => DateTime.fromMillis(t.question.created_at, { zone: tz }).toFormat("ccc d LLL")))];
    return { kind: "recalled", label: turns.length === 1 ? `Recalled your chat from ${dates[0]}` : `Recalled ${turns.length} chats (${dates.join(", ")})` };
  }
  const asked = [...new Set(m.ranges.map((r) => r.ref.phrase.replace(/^on\s+/i, "")))];
  return { kind: "none", label: `No record found${asked.length ? ` for "${asked.join('", "')}"` : " of that conversation"}` };
}

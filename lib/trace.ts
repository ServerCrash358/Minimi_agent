// A Trace is the readable record of one turn: what the deterministic pipeline decided
// before the model ran, what the model searched, and how long each part took.
// It is stored per assistant message and rendered on /debug.

export type SearchTrace = {
  query: string;
  site?: string;
  since?: string;
  cached: boolean;
  ms: number;
  results: number;
  error?: string;
  /** A page contained text addressed to AI assistants; it was removed before the model saw it. */
  flagged?: boolean;
  /** Started by the pipeline before the model ran, not chosen by the model. */
  prefetched?: boolean;
  /** An exact repeat of a search already made this turn, answered from memory without running it again. */
  memoised?: boolean;
};

export type Trace = {
  startedAt: number; // clock time (ms)
  tz: string;
  model: string;
  userText: string;
  /** What the temporal resolver made of the message (empty when it mentions no date). */
  resolvedDates: unknown[];
  /** Summary of memory retrieval: which turns were found for which date, by topic, by entity. */
  memory: unknown;
  /** What kind of turn the pipeline decided this was, and why (see lib/agent/intent.ts). */
  intent?: { kind: string; reason: string };
  /** Searches the pipeline started before the model ran, for a re-check. */
  prefetch?: { planned: number; ms: number };
  /** The post-answer check: what was wrong with the draft, and whether it was rewritten once. */
  guard?: { defects: string[]; repaired: boolean };
  /** The memory chip shown above the answer. */
  chip?: { kind: "recalled" | "none"; label: string; rechecked?: number };
  searches: SearchTrace[];
  steps: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  /**
   * firstTokenMs: first text of any kind (may be a short "let me check" before the searches).
   * answerStartMs: when the final answer starts streaming, i.e. first text after the last tool result.
   * It is the number a reader actually waits for; it equals firstTokenMs when no search was needed.
   */
  timings: { memoryMs?: number; firstTokenMs?: number; answerStartMs?: number; totalMs?: number };
  /** Size of the "Prior conversations" block sent to the model (0 or undefined: memory not consulted). */
  memoryBlockChars?: number;
  /** The block itself, exactly as the model saw it, so /debug can show what it was working from. */
  memoryBlock?: string;
  finishReason?: string;
  error?: string;
};

export function newTrace(init: Pick<Trace, "startedAt" | "tz" | "model" | "userText">): Trace {
  return { ...init, resolvedDates: [], memory: null, searches: [], steps: 0, timings: {} };
}

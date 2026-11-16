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
  searches: SearchTrace[];
  steps: number;
  usage?: { inputTokens?: number; outputTokens?: number };
  timings: { memoryMs?: number; firstTokenMs?: number; totalMs?: number };
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

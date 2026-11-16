import {
  createUIMessageStream,
  isStepCount,
  streamText,
  toUIMessageStream,
  type InferUIMessageChunk,
  type LanguageModel,
  type ModelMessage,
  type StreamTextEndEvent,
  type UIMessageChunk,
} from "ai";
import { DateTime } from "luxon";
import { nowMs } from "../clock";
import { db } from "../db";
import {
  ensureThread,
  getSourcesForMessages,
  getThreadMessages,
  insertMessage,
  insertSources,
  newId,
  saveTurnTrace,
  setThreadTitle,
  type MessageRow,
  type SourceRow,
} from "../db/repo";
import { memoryChip } from "../memory/chip";
import { renderMemoryBlock } from "../memory/context";
import { retrieveMemory, summariseMemory, type Memory } from "../memory/retrieve";
import { resolveDates } from "../temporal/resolve";
import { normaliseCitations, stripThinking } from "../text";
import { newTrace, type Trace } from "../trace";
import type { ChatMessage, SearchToolOutput } from "../types";
import { checkEarlierValues, renderEvidence } from "./evidence";
import { inspectAnswer, repairAnswer } from "./guard";
import { classifyIntent } from "./intent";
import { mainModel, providerOptionsFor } from "./model";
import { planPrefetch, recalledFacts } from "./prefetch";
import { buildSystemPrompt } from "./prompt";
import { SourceCollector, createSearchExecutor, makeSearchTool, type SearchFn } from "./tool";

/** Model calls allowed per answer. The last one has tools switched off so it must answer. */
export const MAX_STEPS = 5;
/** Give up when nothing has happened for this long, or when the whole turn exceeds the total. */
const IDLE_MS = 40_000;
const TOTAL_MS = 100_000;
const HISTORY_MESSAGES = 16;
const HISTORY_CHARS = 6000;

export type TurnInput = {
  userId: string;
  threadId: string;
  text: string;
  tz: string;
  /** Test / eval seams. */
  search?: SearchFn;
  model?: { model: LanguageModel; label: string };
  limits?: { idleMs?: number; totalMs?: number };
  signal?: AbortSignal;
};

export type TurnOutcome = { assistantMessageId: string; text: string; trace: Trace };

/** The searches done so far, as plain text, for the forced final step. */
export function digestOfSearches(outputs: SearchToolOutput[]): string {
  const lines = ["# Search results gathered so far (use these; cite with the [n] shown)"];
  for (const o of outputs) {
    if (!o || typeof o !== "object") continue;
    lines.push(`\nSearch: ${o.query}`);
    if ("error" in o) lines.push(`(failed: ${o.error})`);
    else for (const r of o.results) lines.push(`${r.cite} ${r.title} (${r.url}${r.date ? `, ${r.date}` : ""}): ${r.excerpt}`);
  }
  if (lines.length === 1) lines.push("(no searches were run)");
  return lines.join("\n");
}

export function validTimezone(tz: string | undefined): string {
  return tz && DateTime.local().setZone(tz).isValid ? tz : "UTC";
}

/** Earlier messages in this thread as plain model messages (text only; sources appended so [n] still resolves). */
function threadHistory(rows: MessageRow[], sources: SourceRow[]): ModelMessage[] {
  const byMsg = new Map<string, SourceRow[]>();
  for (const s of sources) byMsg.set(s.message_id, [...(byMsg.get(s.message_id) ?? []), s]);
  return rows.slice(-HISTORY_MESSAGES).map((m) => {
    let content = m.content.length > HISTORY_CHARS ? m.content.slice(0, HISTORY_CHARS) + " [truncated]" : m.content;
    const srcs = byMsg.get(m.id);
    if (m.role === "assistant" && srcs?.length) {
      content += "\n\nSources used in that answer:\n" + srcs.map((s) => `[${s.n}] ${s.title ?? s.url} - ${s.url}`).join("\n");
    }
    return { role: m.role, content };
  });
}

export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const status = (e as { statusCode?: number })?.statusCode;
  // Specific causes first: a 403 can mean a bad key OR a model this account may not use, and they need different fixes.
  if (/being verified|account.*(suspended|not (yet )?verified)/i.test(msg)) {
    return "The model provider says this account is still being verified. Try again shortly, or switch MODEL to another provider.";
  }
  if (/payment instrument|marketplace subscription/i.test(msg)) {
    return "AWS cannot activate this model's Marketplace subscription: the account needs a valid payment method (AWS Billing console). Credits alone are not enough to enable Anthropic models.";
  }
  if (/use case details/i.test(msg)) {
    return "AWS needs the Anthropic use-case form completed for this account before Claude models can be used (Bedrock console, Model catalog). If you already submitted it, wait about 15 minutes.";
  }
  if (/access ?denied|not authori[sz]ed|don'?t have access|model access|not available for this account|is not supported|invalid model/i.test(msg)) {
    return "The model provider refused access to this model. Check that model access is enabled for this key and region, and that MODEL is spelled correctly.";
  }
  if (status === 401 || status === 403 || /api key|unauthorized|authentication/i.test(msg)) {
    return "The model provider rejected the API key. Check the key in .env.local.";
  }
  if (status === 429 || /rate limit|quota|overloaded|throttl/i.test(msg)) {
    return "The model provider is rate limiting or overloaded right now. Please try again in a moment.";
  }
  if (/timeout|timed out|aborted/i.test(msg)) return "That took too long and was stopped. Please try again.";
  return "Something went wrong while answering. Please try again.";
}

const TURN_NOTES = {
  recall:
    "Web search is not available for this turn, because the user is asking what was said earlier and the answer is in the Prior conversations block. " +
    "Answer from the block, quoting it faithfully with its date. If the user may also want current information, say what you would check and offer to do it.",
  conceptual: "This is a general-knowledge question. No web search is needed: answer it directly and concisely from your own knowledge.",
} as const;

/**
 * One turn of the pipeline. The route, the eval harness and /debug all go through here.
 * Returns a UI message stream plus a promise that resolves when the turn is persisted.
 */
export function runTurn(input: TurnInput): { stream: ReadableStream<UIMessageChunk>; done: Promise<TurnOutcome> } {
  const t0 = performance.now();
  const startedAt = nowMs();
  const tz = validTimezone(input.tz);
  const { model, label } = input.model ?? mainModel(); // throws ConfigError before any state changes

  // [persist 1/2] The question is stored before the model runs, so it survives a failed answer.
  ensureThread(input.threadId, input.userId, startedAt);
  const before = getThreadMessages(input.threadId);
  const last = before[before.length - 1];
  // A retry after a failed turn resends the same text: reuse the unanswered question instead of duplicating it.
  const retry = last?.role === "user" && last.content === input.text;
  if (!retry) {
    insertMessage({ threadId: input.threadId, userId: input.userId, role: "user", content: input.text, createdAt: startedAt, tz });
    if (!before.length) setThreadTitle(input.threadId, input.text.replace(/\s+/g, " ").slice(0, 60));
  }
  const history = retry ? before.slice(0, -1) : before;
  const historySources = getSourcesForMessages(history.filter((m) => m.role === "assistant").map((m) => m.id));

  const assistantId = newId();
  const trace = newTrace({ startedAt, tz, model: label, userText: input.text });
  const sources = new SourceCollector();

  // [1] resolve dates, [2] retrieve memory, [3] render it. Deterministic, a few milliseconds, no model call.
  // A failure here must never stop the answer: the model just runs without memory and the trace says why.
  let memoryBlock: string | undefined;
  let memory: Memory | null = null;
  try {
    const refs = resolveDates(input.text, startedAt, tz);
    trace.resolvedDates = refs;
    memory = retrieveMemory({ userId: input.userId, threadId: input.threadId, text: input.text, refs, nowMs: startedAt, tz });
    trace.memory = summariseMemory(memory);
    trace.timings.memoryMs = memory.ms;
    memoryBlock = renderMemoryBlock(memory, { tz, nowMs: startedAt });
    trace.memoryBlockChars = memoryBlock?.length ?? 0;
    trace.memoryBlock = memoryBlock;
    trace.chip = memoryChip(memory, tz, input.userId);
  } catch (e) {
    console.error("[memory] skipped:", e);
    trace.memory = { error: (e as Error)?.message ?? String(e) };
  }

  // [3b] Decide in code what kind of turn this is. Whether to search is not left to the model when a rule can say.
  const intent = classifyIntent(input.text, memory);
  trace.intent = intent;
  const searchOn = intent.kind === "open" || intent.kind === "recheck";
  // The search results as the model reads them, plus (on a re-check) the code's own check of each earlier value
  // against today's pages. See evidence.ts: "$19 is not on the page" is a string search, not a judgment call.
  const digestWithEvidence = (outs: SearchToolOutput[]) => {
    const evidence = intent.kind === "recheck" && memory ? renderEvidence(checkEarlierValues(recalledFacts(memory, input.userId), outs)) : "";
    return digestOfSearches(outs) + (evidence ? "\n\n" + evidence : "");
  };
  const turnNote = intent.kind === "recall" ? TURN_NOTES.recall : intent.kind === "conceptual" ? TURN_NOTES.conceptual : undefined;

  let resolveDone!: (o: TurnOutcome) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<TurnOutcome>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  done.catch(() => {}); // callers that ignore `done` must not trigger unhandled rejections

  const watchdog = { fired: false };

  // The trace is written exactly once per turn, whether it succeeded or not.
  let traceSaved = false;
  const persistTrace = (ok: boolean) => {
    if (traceSaved) return;
    traceSaved = true;
    trace.timings.totalMs ??= Math.round(performance.now() - t0);
    try {
      saveTurnTrace({ id: assistantId, threadId: input.threadId, userId: input.userId, createdAt: nowMs(), ok, trace });
    } catch (e) {
      console.error("[trace] could not save", e);
    }
  };

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantId });
      if (trace.chip) writer.write({ type: "data-memory", id: "memory", data: trace.chip });

      const ctx = { sources, trace, writer, search: input.search };

      // [3c] A re-check: start the searches ourselves, in parallel, from the pages the old answer was read from.
      // The model then reads results in its first step instead of spending a step deciding what to search.
      const prefetched: SearchToolOutput[] = [];
      if (intent.kind === "recheck" && memory) {
        const plan = planPrefetch(memory, tz, input.userId);
        if (plan.length) {
          const started = performance.now();
          const exec = createSearchExecutor(ctx);
          prefetched.push(...(await Promise.all(plan.map((p) => exec(p, { prefetched: true })))));
          trace.prefetch = { planned: plan.length, ms: Math.round(performance.now() - started) };
          if (trace.chip) {
            trace.chip = { ...trace.chip, rechecked: plan.filter((p) => p.site).length };
            writer.write({ type: "data-memory", id: "memory", data: trace.chip });
          }
        }
      }

      const system = buildSystemPrompt({
        now: startedAt,
        tz,
        memoryBlock,
        turnNote,
        prefetched: prefetched.length ? digestWithEvidence(prefetched) : undefined,
      });
      const messages: ModelMessage[] = [...threadHistory(history, historySources), { role: "user", content: input.text }];

      // Watchdog. A provider that hangs must end in a visible error, not an endless spinner.
      // The SDK reports its own timeouts as a silent "abort", so we run the clock ourselves:
      // give up after IDLE_MS with no activity (model chunk or tool result) or TOTAL_MS overall.
      const ac = new AbortController();
      const signal = input.signal ? AbortSignal.any([ac.signal, input.signal]) : ac.signal;
      const fire = () => {
        watchdog.fired = true;
        ac.abort();
      };
      const idleMs = input.limits?.idleMs ?? IDLE_MS;
      const total = setTimeout(fire, input.limits?.totalMs ?? TOTAL_MS);
      let idle = setTimeout(fire, idleMs);
      const touch = () => {
        clearTimeout(idle);
        idle = setTimeout(fire, idleMs);
      };
      const clearTimers = () => {
        clearTimeout(total);
        clearTimeout(idle);
      };

      let signalEnd!: (e: StreamTextEndEvent | null) => void;
      const ended = new Promise<StreamTextEndEvent | null>((res) => (signalEnd = res));

      const toolset = searchOn ? { web_search: makeSearchTool(ctx) } : undefined;

      const result = streamText({
        model,
        system,
        messages,
        ...(toolset ? { tools: toolset } : {}),
        stopWhen: isStepCount(MAX_STEPS),
        // Last step: tools off, so the model must write the answer with what it has.
        // Some providers (Bedrock) silently DROP all tool calls and results from the conversation when tools are
        // disabled, which left a model answering "no searches were available" with four results in hand. So the
        // gathered results are handed over as plain text in the instructions, and the tool traffic is removed
        // from the messages. Same behaviour on every provider.
        prepareStep: ({ stepNumber, steps, initialMessages }) =>
          toolset && stepNumber >= MAX_STEPS - 1
            ? {
                toolChoice: "none",
                messages: initialMessages,
                instructions:
                  buildSystemPrompt({ now: startedAt, tz, memoryBlock, turnNote, searchesLeft: false }) +
                  "\n\n" +
                  digestWithEvidence([...prefetched, ...steps.flatMap((s) => s.toolResults.map((r) => r.output as SearchToolOutput))]),
              }
            : undefined,
        providerOptions: providerOptionsFor(label),
        abortSignal: signal,
        onChunk: ({ chunk }) => {
          touch();
          if (chunk.type === "tool-result") trace.timings.answerStartMs = undefined; // text so far was a preamble
          if (chunk.type === "text-delta") {
            const now = Math.round(performance.now() - t0);
            trace.timings.firstTokenMs ??= now;
            trace.timings.answerStartMs ??= now;
          }
        },
        onAbort: () => {
          clearTimers();
          trace.error = watchdog.fired ? "timed out" : "aborted by client";
          persistTrace(false);
          rejectDone(new Error(trace.error));
          signalEnd(null);
        },
        onEnd: (event) => signalEnd(event),
        onError: ({ error }) => {
          clearTimers();
          trace.error = (error as Error)?.message ?? String(error);
          persistTrace(false);
          rejectDone(error);
          signalEnd(null);
        },
      });

      // Our own timeout surfaces as the SDK's "abort" chunk, which the UI treats as a normal stop.
      // Turn it into an error the user can see. A user-pressed Stop stays a quiet abort.
      // onError here (not just on createUIMessageStream) is what turns a provider failure into readable text;
      // without it the SDK masks every error as "An error occurred."
      // The draft's chunks are forwarded one by one, in order, and "finish" is withheld: a repaired answer may follow.
      const ui = toUIMessageStream({ stream: result.stream, sendStart: false, sendFinish: false, onError: friendlyError }).pipeThrough(
        new TransformStream<UIMessageChunk, UIMessageChunk>({
          transform(chunk, controller) {
            if (chunk.type === "abort" && watchdog.fired) {
              controller.enqueue({ type: "error", errorText: "That took too long and was stopped. Please try again." });
            } else controller.enqueue(chunk);
          },
        }),
      );
      const reader = ui.getReader();
      for (;;) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        writer.write(value as InferUIMessageChunk<ChatMessage>);
      }

      const event = await ended;
      if (!event) return; // aborted or failed: already recorded, and the error chunk (if any) has been written

      // [4b] Check the answer against rules about form, and repair it once if it breaks one.
      trace.steps = event.steps.length;
      trace.finishReason = String(event.finishReason);
      trace.usage = { inputTokens: event.totalUsage?.inputTokens, outputTokens: event.totalUsage?.outputTokens };
      const outputs = [...prefetched, ...event.steps.flatMap((s) => s.toolResults.map((r) => r.output as SearchToolOutput))];
      const entities = new Set(memory ? recalledFacts(memory, input.userId).map((f) => f.entity) : []);
      let text = normaliseCitations(stripThinking(event.text)).trim();
      const defects = inspectAnswer({ text, outputs, recheck: intent.kind === "recheck", recheckItems: entities.size });
      trace.guard = { defects, repaired: false };

      if (defects.length && !watchdog.fired) {
        try {
          const rewrite = await repairAnswer({
            model,
            system:
              buildSystemPrompt({ now: startedAt, tz, memoryBlock, turnNote, searchesLeft: false }) +
              "\n\n" +
              digestWithEvidence(outputs),
            messages,
            draft: text,
            defects,
            providerOptions: providerOptionsFor(label),
            abortSignal: signal,
          });
          const repaired = normaliseCitations(stripThinking(rewrite)).trim();
          if (repaired) {
            writer.write({ type: "data-revised", id: "revised", data: { reason: defects.join(" ") } });
            writer.write({ type: "text-start", id: "revised-text" });
            writer.write({ type: "text-delta", id: "revised-text", delta: repaired });
            writer.write({ type: "text-end", id: "revised-text" });
            text = repaired;
            trace.guard.repaired = true;
          }
        } catch (e) {
          console.error("[guard] repair failed, keeping the draft:", (e as Error)?.message ?? e);
        }
      }
      clearTimers();

      // [persist 2/2] answer, sources, trace.
      trace.timings.totalMs = Math.round(performance.now() - t0);
      if (!text) {
        const err = new Error("The model returned an empty answer.");
        trace.error = err.message;
        persistTrace(false);
        rejectDone(err);
        writer.write({ type: "error", errorText: "The model returned an empty answer. Please try again." });
        return;
      }
      const at = nowMs();
      db().transaction(() => {
        insertMessage({ id: assistantId, threadId: input.threadId, userId: input.userId, role: "assistant", content: text, createdAt: at, tz });
        insertSources(
          assistantId,
          sources.all().map((s) => ({
            n: s.n, url: s.url, title: s.title, fetched_at: s.fetchedAt, published_at: s.publishedAt, snippet: s.snippet,
          })),
        );
      })();
      persistTrace(true);
      resolveDone({ assistantMessageId: assistantId, text, trace });
      writer.write({ type: "finish" });
    },
    onError: (e) => {
      trace.error ??= (e as Error)?.message ?? String(e);
      persistTrace(false);
      rejectDone(e);
      return friendlyError(e);
    },
  });

  return { stream, done };
}

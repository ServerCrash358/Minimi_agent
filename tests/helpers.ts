import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModel, UIMessageChunk } from "ai";
import { openDb, useDb } from "../lib/db";
import { setNowOverride } from "../lib/clock";

export function freshDb(now?: number) {
  const conn = openDb(":memory:");
  useDb(conn);
  setNowOverride(now ?? Date.UTC(2026, 10, 16, 9, 0, 0));
  return conn;
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

export type Script = Array<{ text?: string; calls?: Array<{ name: string; input: unknown }> }>;

/** A model that follows a script: each call to the model plays the next entry. */
export function scriptedModel(script: Script) {
  let i = 0;
  const mock = new MockLanguageModelV4({
    doStream: async () => {
      const step = script[Math.min(i++, script.length - 1)];
      const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
      if (step.text !== undefined) {
        parts.push({ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: step.text }, { type: "text-end", id: "t" });
      }
      (step.calls ?? []).forEach((c, k) =>
        parts.push({ type: "tool-call", toolCallId: `call_${i}_${k}`, toolName: c.name, input: JSON.stringify(c.input) }),
      );
      const reason = step.calls?.length ? "tool-calls" : "stop";
      parts.push({ type: "finish", finishReason: { unified: reason, raw: reason }, usage });
      return {
        stream: new ReadableStream({
          start(c) {
            for (const p of parts) c.enqueue(p);
            c.close();
          },
        }),
      } as never;
    },
  });
  return { model: mock as unknown as LanguageModel, label: "mock:scripted", mock };
}

export async function drain(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const out: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

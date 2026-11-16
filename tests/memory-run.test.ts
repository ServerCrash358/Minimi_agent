import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModel } from "ai";
import { runTurn } from "../lib/agent/run";
import { db } from "../lib/db";
import { getFactsForMessages, getSourcesForMessages } from "../lib/db/repo";
import { extractFactsForMessage } from "../lib/memory/facts";
import { seedDemoHistory } from "../lib/seed";
import { drain, freshDb, scriptedModel } from "./helpers";

const U = "user-1";
const THREAD = "22222222-2222-4222-8222-222222222222";
const WED_18 = DateTime.fromISO("2026-11-18T09:00", { zone: "UTC" }).toMillis();

const systemPromptOf = (mock: { doStreamCalls: Array<{ prompt: unknown }> }, call = 0) => {
  const prompt = mock.doStreamCalls[call].prompt as Array<{ role: string; content: unknown }>;
  return String(prompt.find((m) => m.role === "system")?.content);
};

async function turn(text: string, script = [{ text: "ok" }] as Parameters<typeof scriptedModel>[0]) {
  const m = scriptedModel(script);
  const { stream, done } = runTurn({
    userId: U, threadId: THREAD, text, tz: "UTC", model: { model: m.model, label: "mock" },
    search: async () => [{ title: "Vendor", url: "https://vendor.com/pricing", content: "Pro $30", publishedAt: null }],
  });
  await drain(stream);
  return { ...m, out: await done };
}

test("pipeline: the model receives the dates, the recalled turn and its facts; the trace records them", async () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  const { mock, out } = await turn("On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing since?");

  const system = systemPromptOf(mock);
  assert.match(system, /Today is Wednesday 18 November 2026/);
  assert.match(system, /# Prior conversations/);
  assert.match(system, /Shortlist 5 CRM tools for a 20-person sales team/);
  assert.match(system, /HubSpot Sales Hub \| Starter price per seat per month \| \$20 \| as of 2026-11-16/);
  assert.match(system, /Mon 9 Nov 2026: NO conversations stored/);

  const t = out.trace;
  assert.equal((t.resolvedDates as Array<{ phrase: string }>)[0].phrase, "On Monday");
  assert.ok((t.memoryBlockChars ?? 0) > 500);
  assert.ok(t.timings.memoryMs! < 100, "memory is a few milliseconds of SQL, not a model call");
});

test("pipeline: a fresh question gets no memory block and the model is not told about the past", async () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  const { mock, out } = await turn("What is the latest Node.js LTS version?");
  assert.doesNotMatch(systemPromptOf(mock), /^# Prior conversations/m);
  assert.equal(out.trace.memoryBlockChars, 0);
});

test("pipeline: a new user asking about a date with no history is told so explicitly", async () => {
  freshDb(WED_18);
  const { mock } = await turn("What did I ask you on 3 November? Is your answer still correct today?");
  const system = systemPromptOf(mock);
  assert.match(system, /no stored conversations at all/);
  assert.match(system, /Tue 3 Nov 2026: NO conversations stored/);
});

test("pipeline: the memory block survives into the forced final step", async () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  const loop = scriptedModel([{ calls: [{ name: "web_search", input: { query: "hubspot pricing" } }] }]);
  const { stream, done } = runTurn({
    userId: U, threadId: THREAD, text: "On Monday we shortlisted CRM tools, any pricing change since?", tz: "UTC",
    model: { model: loop.model, label: "mock" }, search: async () => [],
  });
  await drain(stream);
  await done.catch(() => {});
  const last = loop.mock.doStreamCalls.length - 1;
  assert.match(systemPromptOf(loop.mock, last), /^# Prior conversations/m);
  assert.match(systemPromptOf(loop.mock, last), /no searches left/);
});

// ---- fact extraction (step 7)

function extractor(json: unknown): LanguageModel {
  return new MockLanguageModelV4({
    doGenerate: async () =>
      ({
        content: [{ type: "text", text: JSON.stringify(json) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }) as never,
  }) as unknown as LanguageModel;
}

test("facts: stored with the as-of date of the answer and the URL behind the citation number", async () => {
  freshDb(WED_18);
  const { out } = await turn("Compare vendor pricing", [
    { calls: [{ name: "web_search", input: { query: "vendor pricing" } }] },
    { text: "Vendor Pro is $30 per month [1]. Vendor Team is $50 per month." },
  ]);
  const n = await extractFactsForMessage(out.assistantMessageId, {
    model: extractor({
      facts: [
        { entity: "Vendor", attribute: "Pro price per month", value: "$30", source_n: 1 },
        { entity: "Vendor", attribute: "Team price per month", value: "$50", source_n: null },
        { entity: "vendor", attribute: "pro price per month", value: "$31", source_n: 1 }, // duplicate key: dropped
        { entity: "Vendor", attribute: "bogus citation", value: "x", source_n: 9 }, // unknown [9]: no URL, not invented
      ],
    }),
  });
  assert.equal(n, 3);
  const rows = getFactsForMessages([out.assistantMessageId]);
  assert.deepEqual(rows.map((r) => [r.entity, r.attribute, r.value, r.source_url]), [
    ["Vendor", "Pro price per month", "$30", "https://vendor.com/pricing"],
    ["Vendor", "Team price per month", "$50", null],
    ["Vendor", "bogus citation", "x", null],
  ]);
  const stored = db().prepare("SELECT created_at FROM messages WHERE id = ?").get(out.assistantMessageId) as { created_at: number };
  assert.equal(rows[0].as_of, stored.created_at);
  // Running it again replaces, never duplicates.
  await extractFactsForMessage(out.assistantMessageId, { model: extractor({ facts: [{ entity: "Vendor", attribute: "Pro price per month", value: "$30", source_n: 1 }] }) });
  assert.equal(getFactsForMessages([out.assistantMessageId]).length, 1);
});

test("facts: an answer with no sources is not sent to the extractor at all", async () => {
  freshDb(WED_18);
  const { out } = await turn("What is a database index?");
  assert.equal(getSourcesForMessages([out.assistantMessageId]).length, 0);
  let called = false;
  const spy = new MockLanguageModelV4({
    doGenerate: async () => {
      called = true;
      throw new Error("must not be called");
    },
  }) as unknown as LanguageModel;
  assert.equal(await extractFactsForMessage(out.assistantMessageId, { model: spy }), 0);
  assert.equal(called, false);
});

test("facts: an extractor failure is swallowed and leaves the turn intact", async () => {
  freshDb(WED_18);
  const { out } = await turn("Compare vendor pricing", [
    { calls: [{ name: "web_search", input: { query: "vendor pricing" } }] },
    { text: "Vendor Pro is $30 [1]." },
  ]);
  const broken = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("provider down");
    },
  }) as unknown as LanguageModel;
  const log = console.error;
  console.error = () => {};
  try {
    assert.equal(await extractFactsForMessage(out.assistantMessageId, { model: broken }), 0);
  } finally {
    console.error = log;
  }
  assert.equal(getFactsForMessages([out.assistantMessageId]).length, 0);
  assert.match((db().prepare("SELECT content FROM messages WHERE id = ?").get(out.assistantMessageId) as { content: string }).content, /Vendor Pro/);
});

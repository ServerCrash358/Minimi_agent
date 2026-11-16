import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import type { UIMessageChunk } from "ai";
import { inspectAnswer } from "../lib/agent/guard";
import { runTurn } from "../lib/agent/run";
import type { SearchFn } from "../lib/agent/tool";
import { getThreadMessages } from "../lib/db/repo";
import { seedDemoHistory } from "../lib/seed";
import type { SearchToolOutput } from "../lib/types";
import { drain, freshDb, scriptedModel } from "./helpers";

const U = "guard-user";
const THREAD = "33333333-3333-4333-8333-333333333333";
// Monday 16 Nov 2026, the clock freshDb() pins. "Last Tuesday" is then Tue 10 Nov: the Postgres demo chat.
const NOW = DateTime.fromISO("2026-11-16T09:00", { zone: "UTC" }).toMillis();

const found: SearchToolOutput = { query: "q", cached: false, results: [{ n: 1, cite: "[1]", title: "T", url: "https://x.com", date: null, excerpt: "Pro $5" }] };
const failed: SearchToolOutput = { query: "q", error: "timed out", results: [] };

const systemOf = (call: { prompt: unknown }) =>
  String((call.prompt as Array<{ role: string; content: unknown }>).find((m) => m.role === "system")?.content);

const types = (chunks: UIMessageChunk[]) => chunks.map((c) => c.type);

// ---------------------------------------------------------------- inspectAnswer

test("guard: a good answer has no defects, including a short honest one that needed no search", () => {
  const good = "As of 16 November 2026, Pro is $5 per month [1].";
  assert.deepEqual(inspectAnswer({ text: good, outputs: [found], recheck: false, recheckItems: 0 }), []);
  assert.deepEqual(inspectAnswer({ text: "I have no record of that.", outputs: [], recheck: false, recheckItems: 0 }), [], "no search, no rules about citations");
  assert.deepEqual(inspectAnswer({ text: "I could not verify it.", outputs: [failed], recheck: false, recheckItems: 0 }), [], "a failed search has nothing to cite");
});

test("guard: each rule fires for the defect it exists for", () => {
  const d = (text: string, over = {}) => inspectAnswer({ text, outputs: [found], recheck: false, recheckItems: 0, ...over });
  assert.match(d("")[0], /empty/);
  assert.match(d("Search Neon pricing.").join(" "), /too short/);
  assert.match(d("As of 16 November 2026, Pro is $5 per month.").join(" "), /Cite sources inline/);
  assert.match(d("Pro is $5 per month [1], and it has been for a while now.").join(" "), /Open the answer with the date/);
  const list = "As of 16 November 2026: Neon changed [1]; Supabase unchanged [1]; RDS unchanged [1].";
  assert.match(d(list, { recheck: true, recheckItems: 3 }).join(" "), /markdown table/);
  assert.deepEqual(d(list, { recheck: true, recheckItems: 2 }), [], "a table is only demanded for 3 or more items");
});

// ---------------------------------------------------------------- tools gated by intent

test("recall question: web search is not offered at all, and the model is told why", async () => {
  freshDb(NOW);
  seedDemoHistory({ userId: U, nowMs: NOW, tz: "UTC" });
  const m = scriptedModel([{ text: "On Tue 10 Nov you asked about Postgres hosting; Neon was $19." }]);
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "Last Tuesday I asked you about Postgres hosting. Which provider did you say was cheapest to start with?", tz: "UTC", model: { model: m.model, label: "mock" } });
  await drain(stream);
  const out = await done;
  assert.equal(out.trace.intent?.kind, "recall");
  assert.ok(!m.mock.doStreamCalls[0].tools?.length, "no tools were sent to the model");
  assert.match(systemOf(m.mock.doStreamCalls[0]), /Web search is not available for this turn/);
  assert.equal(out.trace.searches.length, 0);
});

test("conceptual question: no tools, no memory block, answered directly", async () => {
  freshDb(NOW);
  seedDemoHistory({ userId: U, nowMs: NOW, tz: "UTC" });
  const m = scriptedModel([{ text: "An index is a data structure that speeds up lookups." }]);
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "What is a database index and when would I use one?", tz: "UTC", model: { model: m.model, label: "mock" } });
  await drain(stream);
  const out = await done;
  assert.equal(out.trace.intent?.kind, "conceptual");
  assert.ok(!m.mock.doStreamCalls[0].tools?.length);
  assert.doesNotMatch(systemOf(m.mock.doStreamCalls[0]), /^# Prior conversations/m);
  assert.equal(out.trace.guard?.repaired, false);
});

test("a question about the live world keeps the search tool", async () => {
  freshDb(NOW);
  const m = scriptedModel([{ text: "As of 16 November 2026, it is v26 [1]." }]);
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "What is the latest Node.js LTS version?", tz: "UTC", model: { model: m.model, label: "mock" }, search: async () => [] });
  await drain(stream);
  await done.catch(() => {});
  assert.equal(m.mock.doStreamCalls[0].tools?.length, 1);
});

// ---------------------------------------------------------------- prefetch

test("re-check: the pipeline searches each vendor's page itself, and the model answers in ONE step", async () => {
  freshDb(NOW);
  seedDemoHistory({ userId: U, nowMs: NOW, tz: "UTC" });
  const calls: Array<{ query: string; site?: string; since?: string }> = [];
  const search: SearchFn = async (p) => {
    calls.push({ query: p.query, site: p.site, since: p.since });
    return [{ title: `${p.site ?? "news"} page`, url: `https://${p.site ?? "news.example"}/pricing`, content: `current price for ${p.query}: $9`, publishedAt: null }];
  };
  const answer =
    "As of 16 November 2026, Neon changed [1].\n\n| Item | Then | Now | Verdict | Source |\n| --- | --- | --- | --- | --- |\n| Neon | $19 | $9 | Changed | [1] |\n| Supabase | $25 | $9 | Changed | [2] |\n| RDS | $12 | $9 | Changed | [3] |";
  const m = scriptedModel([{ text: answer }]);
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?", tz: "UTC", search, model: { model: m.model, label: "mock" } });
  const chunks = await drain(stream);
  const out = await done;

  assert.equal(out.trace.intent?.kind, "recheck");
  assert.deepEqual(new Set(calls.filter((c) => c.site).map((c) => c.site)), new Set(["neon.tech", "supabase.com", "aws.amazon.com"]));
  assert.equal(calls.filter((c) => !c.site).length, 1, "one dated news search");
  assert.equal(calls.find((c) => !c.site)?.since, "2026-11-10");
  assert.equal(m.mock.doStreamCalls.length, 1, "one model step: the searches were already done");
  assert.match(systemOf(m.mock.doStreamCalls[0]), /These searches were already run for you/);
  assert.match(systemOf(m.mock.doStreamCalls[0]), /neon\.tech\/pricing/);
  assert.ok(out.trace.searches.length === 4 && out.trace.searches.every((s) => s.prefetched));
  assert.equal(out.trace.prefetch?.planned, 4);
  assert.ok(chunks.some((c) => c.type === "data-source"), "sources are streamed so [n] links work");
  assert.deepEqual(out.trace.guard, { defects: [], repaired: false });
});

// ---------------------------------------------------------------- repair

test("guard: a draft with no citations is rewritten once; the repair replaces the draft everywhere", async () => {
  freshDb(NOW);
  const search: SearchFn = async () => [{ title: "Vendor", url: "https://vendor.com/p", content: "Pro $30", publishedAt: null }];
  const m = scriptedModel(
    [{ calls: [{ name: "web_search", input: { query: "vendor pro price" } }] }, { text: "Vendor Pro costs $30 per month." }],
    ["As of 16 November 2026, Vendor Pro costs $30 per month [1]."],
  );
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "What does Vendor Pro cost?", tz: "UTC", search, model: { model: m.model, label: "mock" } });
  const chunks = await drain(stream);
  const out = await done;

  assert.equal(out.text, "As of 16 November 2026, Vendor Pro costs $30 per month [1].");
  assert.equal(getThreadMessages(THREAD).at(-1)!.content, out.text, "only the repaired text is stored");
  assert.equal(out.trace.guard?.repaired, true);
  assert.match(out.trace.guard!.defects.join(" "), /Cite sources inline/);

  const t = types(chunks);
  assert.ok(t.indexOf("data-revised") > t.indexOf("text-end"), "the marker follows the end of the draft's own text");
  assert.equal(t.filter((x) => x === "finish").length, 1, "exactly one finish");
  assert.equal(t.at(-1), "finish", "and it is last, after the repaired text");
  assert.ok(t.indexOf("data-revised") < t.lastIndexOf("text-delta"), "the repaired text comes after the revised marker");
});

test("guard: never loops. A second bad answer is kept as it is, with one repair call at most", async () => {
  freshDb(NOW);
  const search: SearchFn = async () => [{ title: "V", url: "https://v.com/p", content: "Pro $30", publishedAt: null }];
  const m = scriptedModel(
    [{ calls: [{ name: "web_search", input: { query: "price lookup" } }] }, { text: "Costs $30." }],
    ["Still no citation or date."],
  );
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "What does Vendor Pro cost?", tz: "UTC", search, model: { model: m.model, label: "mock" } });
  await drain(stream);
  const out = await done;
  assert.equal(out.text, "Still no citation or date.");
  assert.equal(m.mock.doGenerateCalls.length, 1);
});

test("guard: an empty draft after searching is repaired instead of failing the turn", async () => {
  freshDb(NOW);
  const search: SearchFn = async () => [{ title: "V", url: "https://v.com/p", content: "Pro $30", publishedAt: null }];
  const m = scriptedModel(
    [{ calls: [{ name: "web_search", input: { query: "price lookup" } }] }, { text: "" }],
    ["As of 16 November 2026, Pro is $30 per month [1]."],
  );
  const { stream, done } = runTurn({ userId: U, threadId: THREAD, text: "What does Vendor Pro cost?", tz: "UTC", search, model: { model: m.model, label: "mock" } });
  await drain(stream);
  const out = await done;
  assert.match(out.text, /\$30 per month \[1\]/);
  assert.equal(out.trace.guard?.repaired, true);
});

test("guard: a failed repair keeps the draft; an empty draft with a failed repair is an error", async () => {
  freshDb(NOW);
  const search: SearchFn = async () => [{ title: "V", url: "https://v.com/p", content: "Pro $30", publishedAt: null }];
  const log = console.error;
  console.error = () => {};
  try {
    const keep = scriptedModel([{ calls: [{ name: "web_search", input: { query: "price lookup" } }] }, { text: "Costs $30 per month, I believe." }], []);
    const a = runTurn({ userId: U, threadId: THREAD, text: "What does Vendor Pro cost?", tz: "UTC", search, model: { model: keep.model, label: "mock" } });
    await drain(a.stream);
    assert.equal((await a.done).text, "Costs $30 per month, I believe.", "the repair call threw, so the draft stands");

    freshDb(NOW);
    const none = scriptedModel([{ calls: [{ name: "web_search", input: { query: "price lookup" } }] }, { text: "" }], []);
    const b = runTurn({ userId: U, threadId: THREAD, text: "What does Vendor Pro cost?", tz: "UTC", search, model: { model: none.model, label: "mock" } });
    const chunks = await drain(b.stream);
    await assert.rejects(b.done, /empty answer/);
    assert.ok(chunks.some((c) => c.type === "error"), "the user sees an error, not silence");
  } finally {
    console.error = log;
  }
});

// ---------------------------------------------------------------- memory chip

test("memory chip: recalled, none, and absent for a fresh question; survives in the stored trace", async () => {
  freshDb(NOW);
  seedDemoHistory({ userId: U, nowMs: NOW, tz: "UTC" });
  const run = async (text: string) => {
    const m = scriptedModel([{ text: "ok" }]);
    const { stream, done } = runTurn({ userId: U, threadId: crypto.randomUUID(), text, tz: "UTC", model: { model: m.model, label: "mock" }, search: async () => [] });
    const chunks = await drain(stream);
    await done.catch(() => {});
    return chunks.filter((c) => c.type === "data-memory") as unknown as Array<{ data: { kind: string; label: string; rechecked?: number } }>;
  };

  const recalled = await run("What did I ask you on 3 November?");
  assert.equal(recalled.at(-1)!.data.kind, "recalled");
  assert.match(recalled.at(-1)!.data.label, /Recalled your chat from Tue 3 Nov/);

  const none = await run("What did I ask you on 12 September?");
  assert.equal(none.at(-1)!.data.kind, "none");
  assert.match(none.at(-1)!.data.label, /No record found for "12 September"/);

  assert.deepEqual(await run("What is the latest Node.js LTS version?"), [], "a fresh question carries no chip");
});

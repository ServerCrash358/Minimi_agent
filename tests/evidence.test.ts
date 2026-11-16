import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { checkEarlierValues, renderEvidence } from "../lib/agent/evidence";
import { runTurn } from "../lib/agent/run";
import type { SearchFn } from "../lib/agent/tool";
import type { FactRow } from "../lib/db/repo";
import type { SearchToolOutput } from "../lib/types";
import { seedDemoHistory } from "../lib/seed";
import { drain, freshDb, scriptedModel } from "./helpers";

const fact = (entity: string, value: string, url: string, attribute = "price per month"): FactRow => ({
  id: 1, message_id: "m", user_id: "u", entity, attribute, value, source_url: url, as_of: 0,
});
const page = (url: string, excerpt: string): SearchToolOutput => ({
  query: "q", cached: false, results: [{ n: 1, cite: "[1]", title: "T", url, date: null, excerpt }],
});
const failed: SearchToolOutput = { query: "q", error: "timed out", results: [] };

test("evidence: an earlier price that is missing from today's page is reported; one that is present is not", () => {
  const facts = [
    fact("Neon", "$19", "https://neon.tech/pricing"),
    fact("Supabase", "$25", "https://supabase.com/pricing"),
  ];
  const outputs = [
    page("https://neon.tech/pricing", "Launch plan: usage-based with a $0 monthly minimum. Compute $0.106 per CU-hour."),
    page("https://supabase.com/pricing", "Pro plan: $25 per month per project."),
  ];
  const ev = checkEarlierValues(facts, outputs);
  assert.deepEqual(ev.map((e) => [e.entity, e.status]), [["Neon", "absent"]]);
  assert.match(renderEvidence(ev), /Neon \| price per month \| earlier value "\$19" is NOT FOUND anywhere on the neon\.tech pages/);
});

test("evidence: matching is exact on numbers, tolerant on formatting", () => {
  const f = (v: string) => [fact("X", v, "https://x.com/p")];
  const on = (text: string) => [page("https://x.com/p", text)];
  assert.equal(checkEarlierValues(f("$19"), on("Now $190 per seat")).length, 1, "$190 is not $19");
  assert.equal(checkEarlierValues(f("$19"), on("Now $19.00 per seat")).length, 0, "$19.00 is $19");
  assert.equal(checkEarlierValues(f("$1,200"), on("Now $1200 per year")).length, 0, "thousands separators are ignored");
  assert.equal(checkEarlierValues(f("$ 19"), on("only $19 today")).length, 0, "spacing after the currency sign is ignored");
  assert.equal(checkEarlierValues(f("about $12 plus storage"), on("db.t4g.micro: about $12 per month plus storage")).length, 0, "the price inside a phrase is what counts");
  assert.equal(checkEarlierValues(f("3.14"), on("Python 3.145 is not a thing")).length, 1, "3.14 is not found inside 3.145");
  assert.equal(checkEarlierValues(f("3.14"), on("Python 3.14 is in bugfix maintenance")).length, 0, "presence is not reported, even though it may be the previous release");
});

test("evidence: a vendor whose page could not be fetched is reported as unverifiable, never as unchanged", () => {
  const ev = checkEarlierValues([fact("Freshsales", "$11", "https://www.freshworks.com/crm/pricing/")], [failed, page("https://hubspot.com/p", "$30")]);
  assert.deepEqual(ev.map((e) => [e.entity, e.status]), [["Freshsales", "unreachable"]]);
  assert.match(renderEvidence(ev), /CANNOT be verified/);
});

test("evidence: facts with no price or number, or no source page, are ignored; nothing to say renders nothing", () => {
  assert.deepEqual(checkEarlierValues([fact("Notion", "Free for individuals", "https://notion.so/p")], [page("https://notion.so/p", "x")]), []);
  assert.deepEqual(checkEarlierValues([{ ...fact("A", "$5", "x"), source_url: null }], []), []);
  assert.equal(renderEvidence([]), "");
});

test("pipeline: on a re-check the model is shown which earlier values vanished from the vendor pages", async () => {
  const NOW = DateTime.fromISO("2026-11-16T09:00", { zone: "UTC" }).toMillis();
  freshDb(NOW);
  seedDemoHistory({ userId: "ev-user", nowMs: NOW, tz: "UTC" });
  const search: SearchFn = async (p) => {
    if (p.site === "neon.tech") return [{ title: "Neon pricing", url: "https://neon.tech/pricing", content: "Launch plan: usage-based, $0 monthly minimum.", publishedAt: null }];
    if (p.site === "supabase.com") return [{ title: "Supabase", url: "https://supabase.com/pricing", content: "Pro plan: $25 per month.", publishedAt: null }];
    if (p.site === "aws.amazon.com") throw new Error("boom");
    return [];
  };
  const m = scriptedModel([{ text: "As of 16 November 2026 [1].\n\n| Item | Then | Now | Verdict | Source |\n| --- | --- | --- | --- | --- |\n| Neon | $19 | $0 | Changed | [1] |\n| Supabase | $25 | $25 | Unchanged | [2] |\n| RDS | $12 | ? | Could not verify | n/a |" }]);
  const { stream, done } = runTurn({ userId: "ev-user", threadId: "44444444-4444-4444-8444-444444444444", text: "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?", tz: "UTC", search, model: { model: m.model, label: "mock" } });
  await drain(stream);
  await done;
  const system = String((m.mock.doStreamCalls[0].prompt as Array<{ role: string; content: unknown }>).find((x) => x.role === "system")?.content);
  assert.match(system, /# Mechanical check of the earlier values/);
  assert.match(system, /Neon \| Launch plan price per month \| earlier value "\$19" is NOT FOUND/);
  assert.match(system, /RDS for PostgreSQL \| db\.t4g\.micro approximate price per month \| earlier value "about \$12 plus storage": no aws\.amazon\.com page could be fetched/);
  assert.doesNotMatch(system, /Supabase \| Pro plan price per month \| earlier value/, "an unchanged price produces no warning");
});

test("search memo: an exact repeat of a search made this turn is answered without running it again", async () => {
  freshDb();
  let runs = 0;
  const search: SearchFn = async () => {
    runs++;
    return [{ title: "V", url: "https://v.com/p", content: "Pro $30", publishedAt: null }];
  };
  const m = scriptedModel([
    { calls: [{ name: "web_search", input: { query: "vendor pro price", site: "v.com" } }, { name: "web_search", input: { query: "Vendor Pro Price", site: "https://www.v.com/x" } }] },
    { calls: [{ name: "web_search", input: { query: "vendor pro price", site: "v.com" } }] },
    { text: "As of 16 November 2026, Pro is $30 [1]." },
  ]);
  const { stream, done } = runTurn({ userId: "memo-user", threadId: "55555555-5555-4555-8555-555555555555", text: "What does Vendor Pro cost?", tz: "UTC", search, model: { model: m.model, label: "mock" } });
  await drain(stream);
  const out = await done;
  assert.equal(runs, 1, "three identical searches ran once");
  assert.equal(out.trace.searches.length, 3);
  assert.equal(out.trace.searches.filter((s) => s.memoised).length, 2);
});

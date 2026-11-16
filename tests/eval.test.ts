import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { percentile, renderResultsMarkdown, runEval, stats, writeReport } from "../lib/eval/runner";
import { scriptedModel } from "./helpers";

test("percentile: nearest-rank, robust to tiny samples and order", () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile([5, 1, 3, 2, 4], 90), 5);
  assert.equal(percentile([7], 90), 7);
  assert.ok(Number.isNaN(percentile([], 50)));
  assert.deepEqual(stats([1000, 2000, 3000, NaN]), { n: 3, mean: 2000, p50: 2000, p90: 3000, max: 3000 });
});

async function runOne(id: string, answer: string) {
  const m = scriptedModel([{ text: answer }]);
  return runEval({ only: [id], model: { model: m.model, label: "mock:scripted" } });
}

test("the timezone case finds the user's local 'yesterday' (this exercises the real resolver and retrieval)", async () => {
  const r = await runOne("timezone-edge", "Yesterday you asked how much Linear costs per seat.");
  assert.equal(r.results.length, 1);
  assert.deepEqual(r.results[0].checks.filter((c) => !c.ok), []);
  assert.equal(r.results[0].passed, true);
});

test("the no-record case passes when the answer admits it, and FAILS when the answer invents a past", async () => {
  const honest = await runOne("no-history-date", "I have no record of a conversation on that date.");
  assert.equal(honest.results[0].passed, true);
  assert.equal(honest.results[0].checks.find((c) => c.name.includes("recalled") || c.name.includes("no conversation"))?.ok, true);

  const invented = await runOne("no-history-date", "On that day you asked me to compare HubSpot and Pipedrive.");
  assert.equal(invented.results[0].passed, false, "an invented recollection must fail the case");
  assert.match(invented.results[0].checks.find((c) => !c.ok)!.name, /no record/);
});

test("a brand-new user: no recall, and demo data from the other user cannot leak", async () => {
  const ok = await runOne("new-user-sample-3", "I have no record of that conversation. Tell me which hosts you compared and I will check.");
  assert.equal(ok.results[0].passed, true);
  const leaked = await runOne("new-user-sample-3", "I have no record of that, but Neon Launch was $19.");
  assert.equal(leaked.results[0].passed, false);
});

test("a model error is reported per case, not thrown, and the run continues", async () => {
  const { MockLanguageModelV4 } = await import("ai/test");
  const broken = new MockLanguageModelV4({ doStream: async () => { throw Object.assign(new Error("Unauthorized"), { statusCode: 401 }); } });
  const r = await runEval({ only: ["no-search-needed", "no-history-date"], model: { model: broken as never, label: "mock:broken" } });
  assert.equal(r.results.length, 2);
  assert.ok(r.results.every((x) => !x.passed && /rejected the API key/.test(x.error ?? "")));
  assert.equal(r.summary.passed, 0);
});

test("reports are written: summary table, per-case transcripts, machine-readable json", async () => {
  const r = await runOne("no-history-date", "I have no record of a conversation on that date.");
  const md = renderResultsMarkdown(r);
  assert.match(md, /Passed 1 of 1/);
  assert.match(md, /\| A date with no conversation/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-"));
  try {
    writeReport(r, dir);
    assert.ok(fs.existsSync(path.join(dir, "RESULTS.md")));
    assert.ok(fs.existsSync(path.join(dir, "transcripts", "no-history-date.md")));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8")).summary.passed, 1);
    assert.match(fs.readFileSync(path.join(dir, "transcripts", "no-history-date.md"), "utf8"), /Prior conversations/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

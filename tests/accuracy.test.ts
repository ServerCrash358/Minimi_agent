import { test } from "node:test";
import assert from "node:assert/strict";
import { verdictFor } from "../lib/eval/accuracy";
import { runEval } from "../lib/eval/runner";
import { cacheGet, cacheSet, exportSearchCache, importSearchCache } from "../lib/search/cache";
import { freshDb, scriptedModel } from "./helpers";

test("verdictFor reads the verdict from the row that names the item", () => {
  const table = [
    "| Item | Then | Now | Verdict | Source |",
    "| --- | --- | --- | --- | --- |",
    "| Neon (Launch) | $19 | $0 minimum | Changed | [1] |",
    "| Supabase Pro | $25 | $25 | Unchanged | [2] |",
    "| Freshsales | $11 | n/a | Could not verify | [3] |",
  ].join("\n");
  assert.equal(verdictFor(table, /neon/i), "changed");
  assert.equal(verdictFor(table, /supabase/i), "unchanged", "'Unchanged' is not mistaken for 'Changed'");
  assert.equal(verdictFor(table, /freshsales/i), "unverified");
  assert.equal(verdictFor(table, /zendesk/i), null);
  assert.equal(verdictFor("HubSpot is now $30 per seat, up from $20.", /hubspot/i), "changed");
  assert.equal(verdictFor("Pipedrive remains the same at $34.", /pipedrive/i), "unchanged");
});

async function accuracy(id: string, answer: string) {
  const m = scriptedModel([{ text: answer }]);
  return runEval({ suite: "accuracy", only: [id], model: { model: m.model, label: "mock:scripted" } });
}

const POSTGRES_RIGHT =
  "As of 16 November 2026, one price moved [1].\n\n| Item | Then | Now | Verdict | Source |\n| --- | --- | --- | --- | --- |\n" +
  "| Neon | $19 | $0 minimum, usage-based | Changed | [1] |\n| Supabase | $25 | $25 | Unchanged | [2] |\n| AWS RDS | about $12 | about $12 | Unchanged | [3] |";

test("accuracy suite: the right verdicts pass, and 'everything changed' or a swapped verdict fails", async () => {
  const right = await accuracy("a1-postgres-one-changed", POSTGRES_RIGHT);
  assert.deepEqual(right.results[0].checks.filter((c) => !c.ok), []);
  assert.equal(right.results[0].passed, true);

  const allChanged = POSTGRES_RIGHT.replace("Unchanged | [2]", "Changed | [2]").replace("Unchanged | [3]", "Changed | [3]");
  const wrong = await accuracy("a1-postgres-one-changed", allChanged);
  assert.equal(wrong.results[0].passed, false);
  assert.deepEqual(wrong.results[0].checks.filter((c) => !c.ok).map((c) => c.name).sort(), ["RDS: unchanged", "Supabase: unchanged"]);

  const swapped = POSTGRES_RIGHT.replace("| Changed | [1] |", "| Unchanged | [1] |");
  assert.equal((await accuracy("a1-postgres-one-changed", swapped)).results[0].passed, false, "missing the one real change fails");
});

test("accuracy suite: a page that failed to load must be reported as unverified, not guessed", async () => {
  const base = (freshsales: string) =>
    "As of 16 November 2026 [1].\n\n| Item | Then | Now | Verdict | Source |\n| --- | --- | --- | --- | --- |\n" +
    "| HubSpot | $20 | $30 | Changed | [1] |\n| Pipedrive | $34 | $34 | Unchanged | [2] |\n| Zoho | $23 | $23 | Unchanged | [3] |\n" +
    `| Salesforce | $25 | $25 | Unchanged | [4] |\n${freshsales}`;
  const honest = await accuracy("a2-crm-one-changed-one-unverifiable", base("| Freshsales | $11 | page unavailable | Could not verify | n/a |"));
  assert.equal(honest.results[0].passed, true);
  const guessed = await accuracy("a2-crm-one-changed-one-unverifiable", base("| Freshsales | $11 | $11 | Unchanged | [5] |"));
  assert.equal(guessed.results[0].passed, false);
  assert.match(guessed.results[0].checks.find((c) => !c.ok)!.name, /Freshsales/);
});

test("accuracy suite: the date-range case does not pull in the unrelated chat that falls inside the range", async () => {
  const answer =
    "As of 16 November 2026 [1].\n\n| Item | Then | Now | Verdict | Source |\n| --- | --- | --- | --- | --- |\n" +
    "| Pinecone | $50 | $50 | Unchanged | [1] |\n| Qdrant | 1 GB free | 4 GB free | Changed | [2] |\n| Weaviate | $45 | $45 | Unchanged | [3] |";
  const r = await accuracy("a5-vectordb-free-tier-grew", answer);
  assert.deepEqual(r.results[0].checks.filter((c) => !c.ok), []);
  const searched = r.results[0].searches.map((s) => s.site).filter(Boolean);
  assert.ok(!searched.includes("typescriptlang.org"), "the TypeScript chat sits inside 'two weeks ago' but is not re-checked");
  assert.deepEqual(new Set(searched), new Set(["pinecone.io", "qdrant.tech", "weaviate.io"]));
});

// ---------------------------------------------------------------- the search cache

test("stubbed searches never write to the cache; real results survive an export and import", () => {
  freshDb();
  const hit = [{ title: "T", url: "https://x.com/p", content: "c", publishedAt: null }];
  cacheSet({ query: "live query" }, hit);
  const rows = exportSearchCache();
  assert.equal(rows.length, 1);

  freshDb(); // a new run: empty database
  assert.equal(cacheGet({ query: "live query" }), null);
  importSearchCache(rows);
  assert.deepEqual(cacheGet({ query: "live query" }), hit, "the same day's result is served again, free");

  freshDb(Date.UTC(2026, 10, 25)); // nine days later
  importSearchCache(rows);
  assert.equal(cacheGet({ query: "live query" }), null, "an old result is dropped, and its key could never match today anyway");
});

// npm run eval [-- --suite=core|holdout|accuracy|all] [--only=id1,id2] [--model=provider:model] [--no-cache] [--list]
//
// Runs an eval suite against the live model and live web search, on a throwaway database.
//   core      the three sample questions and the cases written alongside them  -> eval-output/core/
//   holdout   new questions of the same kinds, written after tuning            -> eval-output/holdout/
//   accuracy  canned vendor pages with known prices: is every verdict right?   -> eval-output/accuracy/ (no search credits)
// Live search results are cached in eval-output/.search-cache.json for the rest of the day (--no-cache to disable).
// A run restricted with --only writes to eval-output/partial/ so it can never replace a full report.
// Exits 1 if any case fails, and 2 if no case got an answer at all (nothing was measured, nothing is overwritten).
import path from "node:path";
import { openDb, useDb } from "../lib/db";
import type { EvalEnv } from "../lib/eval/cases";
import { renderResultsMarkdown, runEval, writeReport } from "../lib/eval/runner";
import { SUITES, type Suite } from "../lib/eval/suites";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const wanted = (arg("suite") ?? "core") as Suite["id"] | "all";
const suiteIds = wanted === "all" ? (Object.keys(SUITES) as Suite["id"][]) : [wanted];
for (const id of suiteIds) {
  if (!SUITES[id]) {
    console.error(`Unknown suite "${id}". Use core, holdout, accuracy or all.`);
    process.exit(2);
  }
}
// Live search results are kept between runs (same day only), so a rerun costs no search credits.
const cacheFile = process.argv.includes("--no-cache") ? undefined : path.resolve("eval-output/.search-cache.json");

if (process.argv.includes("--list")) {
  for (const id of suiteIds) {
    useDb(openDb(":memory:"));
    const nowMs = Date.now();
    const seeded = Object.fromEntries(SUITES[id].seed("u", nowMs, "UTC").map((s) => [s.key, s])) as EvalEnv["seeded"];
    console.log(`\n${SUITES[id].title}`);
    for (const c of SUITES[id].build({ nowMs, tz: "UTC", userId: "u", emptyUserId: "e", seeded })) console.log(`  ${c.id.padEnd(34)} ${c.title}`);
  }
  process.exit(0);
}

const model = arg("model");
if (model) process.env.MODEL = model;
const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);

let worst = 0;
for (const id of suiteIds) {
  console.log(`\nRunning ${SUITES[id].title} with MODEL=${process.env.MODEL ?? "(auto)"} ...\n`);
  const report = await runEval({ suite: id, only, cacheFile, log: (l) => console.log(l) });
  console.log("\n" + renderResultsMarkdown(report));

  // A run where the model never answered (bad key, no access, outage) measures nothing. Do not let it replace the
  // last real results: it once did, and the good transcripts had to be regenerated.
  if (report.results.length > 0 && report.results.every((r) => r.error)) {
    console.error(`\nEvery case failed with a provider error, so nothing was written.\nFirst error: ${report.results[0].error}`);
    worst = Math.max(worst, 2);
    continue;
  }
  const out = path.resolve("eval-output", only?.length ? "partial" : id);
  writeReport(report, out);
  console.log(`Wrote ${path.relative(process.cwd(), out)}`);
  if (report.summary.passed !== report.summary.total) worst = Math.max(worst, 1);
}
process.exit(worst);

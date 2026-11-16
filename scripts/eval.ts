// npm run eval [-- --only=id1,id2] [--model=provider:model] [--list]
// Runs the eval suite against the live model and live web search, on a throwaway database, and writes
// eval-output/latest/{RESULTS.md,results.json,transcripts/*.md}. Exits 1 if any case fails.
import path from "node:path";
import { openDb, useDb } from "../lib/db";
import { buildCases, type EvalEnv } from "../lib/eval/cases";
import { renderResultsMarkdown, runEval, writeReport } from "../lib/eval/runner";
import { seedDemoHistory } from "../lib/seed";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

if (process.argv.includes("--list")) {
  useDb(openDb(":memory:"));
  const nowMs = Date.now();
  const seeded = Object.fromEntries(seedDemoHistory({ userId: "u", nowMs, tz: "UTC" }).map((s) => [s.key, s])) as EvalEnv["seeded"];
  for (const c of buildCases({ nowMs, tz: "UTC", userId: "u", emptyUserId: "e", seeded })) console.log(`${c.id.padEnd(36)} ${c.title}`);
  process.exit(0);
}

const model = arg("model");
if (model) process.env.MODEL = model;
const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);

console.log(`Running eval with MODEL=${process.env.MODEL ?? "(auto)"} ...\n`);
const report = await runEval({ only, log: (l) => console.log(l) });
console.log("\n" + renderResultsMarkdown(report));

// A run where the model never answered (bad key, no access, outage) measures nothing. Do not let it replace the
// last real results: it once did, and the good transcripts had to be regenerated.
if (report.results.length > 0 && report.results.every((r) => r.error)) {
  const e = report.results[0].error;
  console.error(`\nEvery case failed with a provider error, so eval-output/latest was NOT overwritten.\nFirst error: ${e}`);
  process.exit(2);
}
const out = path.resolve("eval-output/latest");
writeReport(report, out);
console.log(`Wrote ${path.relative(process.cwd(), out)}`);
process.exit(report.summary.passed === report.summary.total ? 0 : 1);

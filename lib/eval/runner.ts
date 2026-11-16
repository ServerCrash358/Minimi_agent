import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { runTurn } from "../agent/run";
import { setNowOverride, nowMs } from "../clock";
import { openDb, useDb } from "../db";
import { extractFactsForMessage } from "../memory/facts";
import { seedDemoHistory } from "../seed";
import type { SearchTrace, Trace } from "../trace";
import { buildCases, type EvalCase, type EvalEnv } from "./cases";
import type { SearchFn } from "../agent/tool";
import type { LanguageModel } from "ai";

export type CaseResult = {
  id: string;
  title: string;
  why: string;
  question: string;
  passed: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
  answer: string;
  error?: string;
  firstTokenMs?: number;
  answerStartMs?: number;
  totalMs?: number;
  steps: number;
  searches: SearchTrace[];
  factsStored: number;
  memoryBlock?: string;
};

export type EvalReport = {
  model: string;
  startedAt: string;
  tz: string;
  results: CaseResult[];
  summary: { passed: number; total: number; firstToken: Stats; answerStart: Stats; total_: Stats; avgSearches: number };
};

export type Stats = { n: number; mean: number; p50: number; p90: number; max: number };

/** Nearest-rank percentile. Small samples make interpolation look more precise than it is. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

export function stats(values: number[]): Stats {
  const v = values.filter((x) => Number.isFinite(x));
  return {
    n: v.length,
    mean: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : NaN,
    p50: percentile(v, 50),
    p90: percentile(v, 90),
    max: v.length ? Math.max(...v) : NaN,
  };
}

export type RunOptions = {
  only?: string[];
  log?: (line: string) => void;
  /** Test seams. */
  model?: { model: LanguageModel; label: string };
  search?: SearchFn;
  cases?: (env: EvalEnv) => EvalCase[];
};

export async function runEval(opts: RunOptions = {}): Promise<EvalReport> {
  const log = opts.log ?? (() => {});
  // A throwaway in-memory database: the eval never touches your real history.
  useDb(openDb(":memory:"));
  setNowOverride(null);

  const tz = process.env.EVAL_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const userId = "eval-seeded";
  const emptyUserId = "eval-empty";
  const startedNow = nowMs();
  const seededList = seedDemoHistory({ userId, nowMs: startedNow, tz });
  const env: EvalEnv = {
    nowMs: startedNow,
    tz,
    userId,
    emptyUserId,
    seeded: Object.fromEntries(seededList.map((s) => [s.key, s])) as EvalEnv["seeded"],
  };

  let cases = (opts.cases ?? buildCases)(env);
  if (opts.only?.length) cases = cases.filter((c) => opts.only!.includes(c.id));

  const results: CaseResult[] = [];
  let modelLabel = opts.model?.label ?? "";

  for (const [i, c] of cases.entries()) {
    log(`[${i + 1}/${cases.length}] ${c.id} ...`);
    let who = c.user === "empty" ? emptyUserId : userId;
    let caseTz = tz;
    let pinned: number | null = null;
    if (c.setup) {
      const s = c.setup(env);
      who = s.userId;
      caseTz = s.tz ?? tz;
      pinned = s.pinClockMs ?? null;
    }
    if (pinned !== null) setNowOverride(pinned);

    let answer = "";
    let error: string | undefined;
    let trace: Trace | undefined;
    let factsStored = 0;
    try {
      const { stream, done } = runTurn({
        userId: who,
        threadId: randomUUID(),
        text: c.question,
        tz: caseTz,
        search: c.search ?? opts.search,
        model: opts.model,
      });
      // Drain the stream like a browser would, and keep any error text it carries.
      const reader = stream.getReader();
      let streamError: string | undefined;
      for (;;) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        if (value.type === "error") streamError = (value as { errorText?: string }).errorText;
      }
      try {
        const out = await done;
        answer = out.text;
        trace = out.trace;
        if (c.extractFacts) factsStored = await extractFactsForMessage(out.assistantMessageId);
      } catch (e) {
        error = streamError ?? (e as Error)?.message ?? String(e);
      }
    } catch (e) {
      error = (e as Error)?.message ?? String(e); // e.g. a ConfigError thrown before the stream starts
    } finally {
      if (pinned !== null) setNowOverride(null);
    }

    const fallback: Trace = { startedAt: nowMs(), tz: caseTz, model: modelLabel, userText: c.question, resolvedDates: [], memory: null, searches: [], steps: 0, timings: {}, error };
    const t = trace ?? fallback;
    modelLabel ||= t.model;
    const ctx = { answer, trace: t, error, factsStored };
    const checks = c.checks.map((ck) => {
      let r: true | string;
      try {
        r = ck.test(ctx);
      } catch (e) {
        r = `check threw: ${(e as Error).message}`;
      }
      return r === true ? { name: ck.name, ok: true } : { name: ck.name, ok: false, detail: r };
    });
    const passed = checks.every((x) => x.ok);
    results.push({
      id: c.id, title: c.title, why: c.why, question: c.question, passed, checks, answer, error,
      firstTokenMs: t.timings.firstTokenMs, answerStartMs: t.timings.answerStartMs, totalMs: t.timings.totalMs, steps: t.steps, searches: t.searches, factsStored,
      memoryBlock: t.memoryBlock,
    });
    log(`    ${passed ? "PASS" : "FAIL"}  first token ${t.timings.firstTokenMs ?? "n/a"} ms, total ${t.timings.totalMs ?? "n/a"} ms, ${t.searches.length} searches${error ? `, error: ${error}` : ""}`);
    for (const ck of checks.filter((x) => !x.ok)) log(`      x ${ck.name}: ${ck.detail}`);
  }

  const ok = results.filter((r) => !r.error);
  return {
    model: modelLabel || "unknown",
    startedAt: new Date(startedNow).toISOString(),
    tz,
    results,
    summary: {
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      firstToken: stats(ok.map((r) => r.firstTokenMs ?? NaN)),
      answerStart: stats(ok.map((r) => r.answerStartMs ?? NaN)),
      total_: stats(ok.map((r) => r.totalMs ?? NaN)),
      avgSearches: results.length ? Math.round((results.reduce((a, r) => a + r.searches.length, 0) / results.length) * 10) / 10 : 0,
    },
  };
}

// ---------------------------------------------------------------- output

const sec = (ms?: number) => (ms === undefined || !Number.isFinite(ms) ? "n/a" : `${(ms / 1000).toFixed(1)} s`);

export function renderResultsMarkdown(r: EvalReport): string {
  const s = r.summary;
  const lines = [
    `# Eval results`,
    ``,
    `- Model: \`${r.model}\``,
    `- Run: ${r.startedAt} (timezone ${r.tz})`,
    `- **Passed ${s.passed} of ${s.total}**`,
    `- Time to first token (any text): median ${sec(s.firstToken.p50)}, p90 ${sec(s.firstToken.p90)}, max ${sec(s.firstToken.max)}`,
    `- Time until the answer starts streaming (after any searches): median ${sec(s.answerStart.p50)}, p90 ${sec(s.answerStart.p90)}, max ${sec(s.answerStart.max)}`,
    `- Total time: median ${sec(s.total_.p50)}, p90 ${sec(s.total_.p90)}, max ${sec(s.total_.max)}`,
    `- Searches per answer: ${s.avgSearches} on average`,
    ``,
    `| Case | Result | First token | Answer starts | Total | Searches | Failed checks |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
    ...r.results.map(
      (x) =>
        `| ${x.title} | ${x.passed ? "pass" : "FAIL"} | ${sec(x.firstTokenMs)} | ${sec(x.answerStartMs)} | ${sec(x.totalMs)} | ${x.searches.length} | ${
          x.error ? `error: ${x.error}` : x.checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || "none"
        } |`,
    ),
    ``,
    `Transcripts with the full answer, the memory block the model saw, and every search are in \`eval-output/latest/transcripts/\`.`,
    ``,
  ];
  return lines.join("\n");
}

function transcript(x: CaseResult): string {
  return [
    `# ${x.title}`,
    ``,
    `**Result:** ${x.passed ? "PASS" : "FAIL"}  `,
    `**Why this case exists:** ${x.why}`,
    ``,
    `## Question`,
    ``,
    x.question,
    ``,
    `## Checks`,
    ``,
    ...x.checks.map((c) => `- [${c.ok ? "x" : " "}] ${c.name}${c.detail ? ` (${c.detail})` : ""}`),
    ``,
    `## Timing`,
    ``,
    `First token ${sec(x.firstTokenMs)}, answer starts ${sec(x.answerStartMs)}, total ${sec(x.totalMs)}, ${x.steps} model step(s).${x.error ? `  \nError: ${x.error}` : ""}`,
    ``,
    `## Searches`,
    ``,
    x.searches.length
      ? x.searches.map((s) => `- \`${s.query}\`${s.site ? ` (site ${s.site})` : ""}${s.since ? ` (since ${s.since})` : ""}: ${s.results} results, ${s.ms} ms${s.cached ? ", cached" : ""}${s.error ? `, ERROR ${s.error}` : ""}`).join("\n")
      : "None.",
    ``,
    `## Answer`,
    ``,
    x.answer || "(no answer)",
    ``,
    x.memoryBlock ? `<details><summary>Memory block the model saw</summary>\n\n\`\`\`\n${x.memoryBlock}\n\`\`\`\n\n</details>\n` : "",
  ].join("\n");
}

export function writeReport(r: EvalReport, dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "transcripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "RESULTS.md"), renderResultsMarkdown(r));
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ ...r, results: r.results.map(({ memoryBlock: _m, ...rest }) => rest) }, null, 2));
  for (const x of r.results) fs.writeFileSync(path.join(dir, "transcripts", `${x.id}.md`), transcript(x));
}

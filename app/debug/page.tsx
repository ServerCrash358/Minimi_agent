import { cookies } from "next/headers";
import { listTurnTraces } from "@/lib/db/repo";
import type { Trace } from "@/lib/trace";
import type { summariseMemory } from "@/lib/memory/retrieve";
import { Controls } from "./Controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Debug: what the agent did, turn by turn" };

type Memory = ReturnType<typeof summariseMemory>;
type Ref = { phrase: string; ambiguous: boolean; future: boolean; note?: string; candidates: { label: string }[] };

const ms = (n?: number) => (n === undefined ? "n/a" : n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`);
const card = { borderColor: "var(--line)", background: "var(--card)" } as const;
const muted = { color: "var(--ink-3)" } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-wide" style={muted}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function Turn({ id, createdAt, ok, trace }: { id: string; createdAt: number; ok: boolean; trace: Trace }) {
  const refs = trace.resolvedDates as Ref[];
  const memory = trace.memory as Memory | { error: string } | null;
  const mem = memory && "ranges" in memory ? memory : null;
  const answeredFromMemory = mem?.attempted;
  return (
    <details className="rounded-xl border" style={card}>
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-[14px]">
        <span className="font-semibold" style={{ color: ok ? "var(--ok)" : "var(--bad)" }}>
          {ok ? "ok" : "failed"}
        </span>
        <span style={muted}>{new Date(createdAt).toLocaleString()}</span>
        <span className="min-w-0 flex-1 basis-[22ch] truncate">{trace.userText}</span>
        <span style={muted}>
          answer starts {ms(trace.timings.answerStartMs)} · total {ms(trace.timings.totalMs)} · {trace.steps} step{trace.steps === 1 ? "" : "s"} ·{" "}
          {trace.searches.length} search{trace.searches.length === 1 ? "" : "es"}
        </span>
      </summary>

      <div className="border-t px-4 pb-4 pt-1 text-[13.5px]" style={{ borderColor: "var(--line)" }}>
        {trace.error ? (
          <p className="mt-3" style={{ color: "var(--bad)" }}>
            Error: {trace.error}
          </p>
        ) : null}

        <Section title="1. Dates resolved (chrono-node + calendar rules, in the user's timezone, no model call)">
          {refs.length ? (
            <table className="w-full text-left">
              <thead style={muted}>
                <tr>
                  <th className="pr-3 font-medium">Phrase</th>
                  <th className="pr-3 font-medium">Readings, most likely first</th>
                  <th className="font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {refs.map((r, i) => (
                  <tr key={i} className="align-top">
                    <td className="pr-3">&quot;{r.phrase}&quot;</td>
                    <td className="pr-3">{r.candidates.map((c) => c.label).join(" · ")}</td>
                    <td style={muted}>
                      {[r.ambiguous && "ambiguous", r.future && "future: not looked up", r.note].filter(Boolean).join(". ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={muted}>No date in the message.</p>
          )}
          <p style={muted} className="mt-1">
            Timezone {trace.tz}, clock {new Date(trace.startedAt).toISOString()}
          </p>
        </Section>

        <Section title="2. Memory retrieved (SQLite: date range, full-text topic, entity facts)">
          {memory && "error" in memory ? (
            <p style={{ color: "var(--bad)" }}>Memory failed and was skipped: {memory.error}</p>
          ) : !mem ? (
            <p style={muted}>Not recorded.</p>
          ) : !answeredFromMemory ? (
            <p style={muted}>Not consulted: no past date and no recall cue in the message, so nothing was added to the prompt.</p>
          ) : (
            <div className="space-y-1">
              <p style={muted}>
                {mem.ms} ms · {trace.memoryBlockChars ?? 0} characters sent to the model ·{" "}
                {mem.userHasHistory ? "user has stored history" : "user has no stored history"}
              </p>
              {mem.ranges.flatMap((r) =>
                r.hits.map((h, i) => (
                  <p key={`${r.phrase}-${i}`}>
                    &quot;{r.phrase}&quot; → <strong>{h.label}</strong>: {h.turns.length ? `${h.turns.length} turn${h.turns.length === 1 ? "" : "s"} found` : "no conversations"}
                    {h.nearest.length ? <span style={muted}> (nearest: {h.nearest.join(", ")})</span> : null}
                  </p>
                )),
              )}
              {mem.topicWords.length ? (
                <p>
                  Topic words: <code>{mem.topicWords.join(", ")}</code> → {mem.topical.length} additional turn{mem.topical.length === 1 ? "" : "s"} by keyword search{" "}
                  <span style={muted}>(turns already found by date are not repeated)</span>
                </p>
              ) : null}
              {mem.entityFacts ? <p>{mem.entityFacts} other recorded fact{mem.entityFacts === 1 ? "" : "s"} about the same entities</p> : null}
            </div>
          )}
          {trace.memoryBlock ? (
            <details className="mt-2">
              <summary className="cursor-pointer" style={muted}>
                The &quot;Prior conversations&quot; block exactly as the model saw it
              </summary>
              <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border p-3 text-[12.5px]" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                {trace.memoryBlock}
              </pre>
            </details>
          ) : null}
        </Section>

        <Section title="3. Decision made in code before the model ran">
          {trace.intent ? (
            <p>
              <strong>{trace.intent.kind}</strong>
              <span style={muted}> · {trace.intent.reason}</span>
              {trace.intent.kind === "recall" || trace.intent.kind === "conceptual" ? <span style={muted}> · web search was not offered to the model</span> : null}
              {trace.prefetch ? <span style={muted}> · {trace.prefetch.planned} searches started by the pipeline in {ms(trace.prefetch.ms)}, before the model ran</span> : null}
            </p>
          ) : (
            <p style={muted}>Not recorded (this turn predates the intent step).</p>
          )}
        </Section>

        <Section title="4. Searches">
          {trace.searches.length ? (
            <table className="w-full text-left">
              <thead style={muted}>
                <tr>
                  <th className="pr-3 font-medium">Query</th>
                  <th className="pr-3 font-medium">Site</th>
                  <th className="pr-3 font-medium">Since</th>
                  <th className="pr-3 font-medium">Results</th>
                  <th className="pr-3 font-medium">Time</th>
                  <th className="font-medium">Cache</th>
                </tr>
              </thead>
              <tbody>
                {trace.searches.map((s, i) => (
                  <tr key={i} className="align-top">
                    <td className="pr-3">
                      {s.query}
                      <span style={muted}> · {s.prefetched ? "pipeline" : "model"}</span>
                      {s.flagged ? <span style={{ color: "var(--bad)" }}> (instruction-like text removed)</span> : null}
                      {s.error ? <span style={{ color: "var(--bad)" }}> ({s.error})</span> : null}
                    </td>
                    <td className="pr-3">{s.site ?? "web"}</td>
                    <td className="pr-3">{s.since ?? ""}</td>
                    <td className="pr-3">{s.results}</td>
                    <td className="pr-3">{ms(s.ms)}</td>
                    <td>{s.cached ? "hit" : "miss"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={muted}>None: answered from the conversation and stable knowledge.</p>
          )}
        </Section>

        <Section title="5. Answer check">
          {trace.guard ? (
            trace.guard.defects.length ? (
              <p>
                <strong>{trace.guard.repaired ? "Rewritten once" : "Problems found, draft kept"}</strong>
                <span style={muted}> · {trace.guard.defects.join(" ")}</span>
              </p>
            ) : (
              <p style={muted}>The draft passed every form check (citations, date, table, not empty). No rewrite.</p>
            )
          ) : (
            <p style={muted}>Not recorded.</p>
          )}
        </Section>

        <Section title="6. Timing and model">
          <p style={muted}>
            {trace.model} · memory {ms(trace.timings.memoryMs)} · first token {ms(trace.timings.firstTokenMs)} · answer starts {ms(trace.timings.answerStartMs)} · total {ms(trace.timings.totalMs)} · finish: {trace.finishReason ?? "n/a"}
            {trace.usage?.inputTokens != null ? ` · ${trace.usage.inputTokens} in / ${trace.usage.outputTokens ?? "?"} out tokens` : ""} · id {id.slice(0, 8)}
          </p>
        </Section>
      </div>
    </details>
  );
}

export default async function Debug() {
  const userId = (await cookies()).get("mm_uid")?.value;
  const rows = userId ? listTurnTraces(userId, 30) : [];
  const model = process.env.MODEL?.trim() || "(auto: first provider with credentials)";

  return (
    <main className="mx-auto max-w-[980px] px-4 py-10">
      <a href="/" className="text-[14px] underline underline-offset-2" style={{ color: "var(--ink-2)" }}>
        Back to chat
      </a>
      <h1 className="mt-3 text-2xl font-semibold">Debug</h1>
      <p className="mt-1 max-w-[70ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
        Every turn leaves a trace: which dates were resolved, what memory was retrieved and shown to the model, which searches it chose, and where the
        time went. Model: <code>{model}</code>.
      </p>

      <div className="mt-8">
        <Controls />
      </div>

      <h2 className="mt-12 text-[17px] font-semibold">Recent turns</h2>
      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-[14.5px]" style={muted}>
            No turns yet. Ask something in the chat and it will appear here.
          </p>
        ) : (
          rows.map((r) => <Turn key={r.id} id={r.id} createdAt={r.created_at} ok={!!r.ok} trace={JSON.parse(r.json) as Trace} />)
        )}
      </div>
    </main>
  );
}

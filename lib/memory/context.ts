import { DateTime } from "luxon";
import type { FactRow } from "../db/repo";
import type { Memory, Turn } from "./retrieve";

// Step 3: render retrieved memory as the "Prior conversations" block of the system prompt.
//
// The block is the model's ONLY knowledge of earlier chats, so it is written to make three mistakes hard:
//  - inventing a past answer: past answers are quoted verbatim, with date, and "nothing found" is stated explicitly
//    for every date that was checked;
//  - checking the wrong day: every turn carries its ISO date, which is what `since` in web_search wants;
//  - confusing old and new citation numbers: old [n] belong to the old answer's own source list.

const MAX_BLOCK_CHARS = 14_000;
const MAX_ANSWER_CHARS = 3_500;
const MAX_QUESTION_CHARS = 1_200;

const clip = (s: string, n: number, marker: string) => (s.length > n ? s.slice(0, n) + ` ${marker}` : s);

function renderFacts(facts: FactRow[], tz: string, indent = ""): string[] {
  return facts.map((f) => {
    const asOf = DateTime.fromMillis(f.as_of, { zone: tz }).toFormat("yyyy-MM-dd");
    return `${indent}- ${f.entity} | ${f.attribute} | ${f.value} | as of ${asOf}${f.source_url ? ` | ${f.source_url}` : ""}`;
  });
}

function renderTurn(t: Turn, tz: string, n: number): string {
  const when = DateTime.fromMillis(t.question.created_at, { zone: tz });
  const lines = [
    `### Turn ${n}: ${when.toFormat("ccc d LLL yyyy, HH:mm")} (date for searches: ${when.toFormat("yyyy-MM-dd")})${t.threadTitle ? `, chat "${t.threadTitle}"` : ""}${t.question.demo ? " [demo data]" : ""}`,
    "The user asked:",
    clip(t.question.content, MAX_QUESTION_CHARS, "[truncated]"),
    "",
  ];
  if (t.answer) {
    lines.push("You answered:", clip(t.answer.content, MAX_ANSWER_CHARS, "[answer truncated]"));
    if (t.sources.length) {
      lines.push("", "Sources you cited in that answer (its [n] numbers refer to this list):");
      for (const s of t.sources) lines.push(`[${s.n}] ${s.title ?? s.url} - ${s.url}${s.published_at ? ` (published ${s.published_at})` : ""}`);
    }
    if (t.facts.length) {
      lines.push("", `Claims recorded from that answer (entity | attribute | value | as-of date | source):`, ...renderFacts(t.facts, tz));
    }
  } else {
    lines.push("(No answer was stored for this question.)");
  }
  return lines.join("\n");
}

export function renderMemoryBlock(m: Memory, opts: { tz: string; nowMs: number }): string | undefined {
  const { tz } = opts;
  if (!m.attempted) return undefined; // a fresh question: memory was not consulted, so say nothing about it
  const hasRefs = m.ranges.length > 0;

  const today = DateTime.fromMillis(opts.nowMs, { zone: tz }).toFormat("ccc d LLL yyyy");
  const head: string[] = [
    "# Prior conversations",
    `Retrieved from this user's stored history (timezone ${tz}, today is ${today}). This is the complete record: anything not listed here was not stored.`,
    "Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.",
    "If the user is not actually asking about an earlier conversation, ignore this section.",
  ];
  if (!m.userHasHistory) head.push("This user has no stored conversations at all outside the current chat.");
  else if (!hasRefs && !m.topical.length && !m.entityFacts.length) {
    head.push("No stored conversation matched the topic words in the user's message.");
  }

  if (hasRefs) {
    head.push("", "Dates found in the user's message and what was found for each:");
    for (const { ref, hits } of m.ranges) {
      const parts = hits.map((h) => `${h.candidate.label}: ${h.turns.length ? `${h.turns.length} turn${h.turns.length === 1 ? "" : "s"}` : "no conversations"}`);
      head.push(`- "${ref.phrase}"${ref.ambiguous ? " (ambiguous)" : ""} -> ${parts.join("; ")}${ref.note ? `. ${ref.note}` : ""}`);
    }
  }

  const sections: string[] = [];
  let turnNo = 0;
  for (const { ref, hits } of m.ranges) {
    for (const h of hits) {
      if (h.turns.length) {
        sections.push(`## ${h.candidate.label} (${h.turns.length} turn${h.turns.length === 1 ? "" : "s"}, for "${ref.phrase}")`);
        for (const t of h.turns) sections.push(renderTurn(t, tz, ++turnNo));
      } else {
        const near = [h.nearestBefore && `${h.nearestBefore.label} (${h.nearestBefore.turns} question${h.nearestBefore.turns === 1 ? "" : "s"}, first: "${h.nearestBefore.firstQuestion}")`, h.nearestAfter && `${h.nearestAfter.label} (${h.nearestAfter.turns} question${h.nearestAfter.turns === 1 ? "" : "s"}, first: "${h.nearestAfter.firstQuestion}")`].filter(Boolean);
        sections.push(
          `## ${h.candidate.label}: NO conversations stored.` +
            (near.length ? ` Nearest days with conversations: ${near.join("; ")}.` : m.userHasHistory ? "" : ""),
        );
      }
    }
  }

  if (m.topical.length) {
    sections.push(`## Conversations matching the topic (${m.topicWords.join(", ")}), found by keyword search, any date`);
    for (const t of m.topical) sections.push(renderTurn(t, tz, ++turnNo));
  }
  if (m.entityFacts.length) {
    sections.push("## Other claims recorded earlier about the same entities (entity | attribute | value | as-of date | source)", ...renderFacts(m.entityFacts, tz));
  }

  // When nothing was found, say what that obliges the model to do, last in the prompt where it is most likely to be
  // obeyed. A weaker model was observed building a whole "Then" column out of search results when the block merely
  // said nothing was stored; the consequence has to be spelled out, not left to inference.
  const foundAnything = m.ranges.some((r) => r.hits.some((h) => h.turns.length)) || m.topical.length > 0;
  if (!foundAnything) {
    sections.push(
      [
        "## RECORD STATUS: NO EARLIER CONVERSATION WAS FOUND for the date(s) and topic in the user's message.",
        "If the user is referring to an earlier conversation:",
        "1. Say so first, plainly, naming the date(s) you checked" + (m.userHasHistory ? " (and mention the nearest conversations listed above, if any)." : "."),
        '2. Do NOT state or imply any earlier answer, price, plan or "Then" value, and do not build a before/after table. There is no "before" to compare with, and values from your own knowledge or from search results are not what you said earlier.',
        "3. If the user's message itself names the items to check (for example the tools or hosts), you may report their CURRENT state and say clearly that you cannot compare it with an earlier answer. Otherwise offer to check them now once the user says what was discussed.",
      ].join("\n"),
    );
  }

  // Fit the budget by dropping from the end, never by cutting a turn in half.
  let out = head.join("\n");
  let omitted = 0;
  for (const s of sections) {
    if (out.length + s.length + 2 > MAX_BLOCK_CHARS && s.startsWith("### Turn")) {
      omitted++;
      continue;
    }
    out += "\n\n" + s;
  }
  if (omitted) out += `\n\n(${omitted} more matching turn${omitted === 1 ? "" : "s"} omitted for length.)`;
  return out;
}

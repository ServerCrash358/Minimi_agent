import { DateTime } from "luxon";
import type { FactRow } from "../db/repo";
import { topicScores, type Memory, type Turn } from "../memory/retrieve";
import type { SearchInput } from "./tool";

// "Has it changed since?" is the same job every time: read each vendor's own page again, and look for news since the
// date of the old answer. The recalled facts already say WHICH pages, because each one carries the URL it was read
// from. So the pipeline can start those searches itself, in parallel, before the model runs. The model then
// reads the results in its first step instead of spending a whole step deciding what to search.
//
// This is still the one tool, web_search: the pipeline just calls it early, through the same executor (cache,
// sanitiser, numbering) the model's own calls use. The model may still search to fill a gap.

export const MAX_PREFETCH_SITES = 6;

const PRICE_ATTRIBUTE = /price|pricing|plan|cost|fee|tier|\$|per (seat|user|agent|month)|minimum/i;

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Unique entity names, dropping any that merely extend another ("Python 3.14" next to "Python"). */
function distinctEntities(facts: FactRow[], max: number): string[] {
  const names = [...new Set(facts.map((f) => f.entity))].sort((a, b) => a.length - b.length);
  const kept: string[] = [];
  for (const n of names) if (!kept.some((k) => n.toLowerCase().includes(k.toLowerCase()))) kept.push(n);
  const order = new Map(facts.map((f, i) => [f.entity, i]));
  return kept.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)).slice(0, max);
}

/**
 * Facts from the recalled turns that are about what the user asked. A date range can hold several chats ("two
 * weeks ago" is a +/-3 day window); when the question names a topic, only the turns that contain it are re-checked.
 * With no topic words, or none matching, every recalled turn counts.
 */
export function recalledTurns(memory: Memory, userId: string): Turn[] {
  // The user anchored the question by date: the chats inside that date come first. Topic matches are only the
  // fallback for when the date held nothing ("on Friday..." about a chat that was really on Thursday). Without this,
  // generic words ("hosting", "database") pulled a Postgres chat into a question about vector databases.
  const ranged = memory.ranges.flatMap((r) => r.hits.flatMap((h) => h.turns));
  const all = ranged.length ? ranged : memory.topical;
  const unique = all.filter((t, i) => all.findIndex((o) => o.question.id === t.question.id) === i);
  if (memory.topicWords.length && unique.length > 1) {
    const scores = topicScores(userId, memory.topicWords, unique);
    const relevant = unique.filter((t) => (scores.get(t.question.id) ?? 0) >= 1);
    if (relevant.length) return relevant;
  }
  return unique;
}

export function recalledFacts(memory: Memory, userId: string): FactRow[] {
  const turns = recalledTurns(memory, userId);
  const seen = new Set<number>();
  return turns.flatMap((t) => t.facts).filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
}

export function planPrefetch(memory: Memory, tz: string, userId: string): SearchInput[] {
  const facts = recalledFacts(memory, userId).filter((f) => f.source_url && hostOf(f.source_url));
  if (!facts.length) return [];

  const byHost = new Map<string, FactRow[]>();
  for (const f of facts) {
    const host = hostOf(f.source_url!)!;
    byHost.set(host, [...(byHost.get(host) ?? []), f]);
  }

  const plan: SearchInput[] = [];
  for (const [host, hostFacts] of [...byHost].slice(0, MAX_PREFETCH_SITES)) {
    const entities = distinctEntities(hostFacts, 2);
    const isPrice = hostFacts.some((f) => PRICE_ATTRIBUTE.test(f.attribute));
    plan.push({ query: `${entities.join(" ")} ${isPrice ? "pricing plans" : "latest stable release"}`, site: host });
  }

  // One dated search for announcements, from the day of the old answer.
  const earliest = Math.min(...facts.map((f) => f.as_of));
  const entities = distinctEntities(facts, 5);
  const anyPrice = facts.some((f) => PRICE_ATTRIBUTE.test(f.attribute));
  plan.push({
    query: `${entities.join(", ")} ${anyPrice ? "pricing changes and new announcements" : "new release announcements"}`,
    since: DateTime.fromMillis(earliest, { zone: tz }).toFormat("yyyy-MM-dd"),
  });
  return plan;
}

import { DateTime } from "luxon";
import { db } from "../db";
import {
  getFactsByEntityWords,
  getFactsForMessages,
  getSourcesForMessages,
  type FactRow,
  type MessageRow,
  type SourceRow,
} from "../db/repo";
import { hasRecallCue, refersToPast, type DateCandidate, type ResolvedReference } from "../temporal/resolve";

// Step 2 of the pipeline. Deterministic SQL, no model call, runs before the model so there is no extra round trip.
//
// Three ways a past turn can be found, because each fails alone:
//  1. By DATE RANGE: exact. "What did I ask on 3 November?" has no topic words at all.
//  2. By TOPIC (SQLite FTS5, BM25): "last Tuesday... Postgres hosting" when the Postgres chat was actually on Wednesday.
//     Without this the agent would say "no record" about a conversation that exists.
//  3. By ENTITY in the facts table: the structured "then" values (price, plan, version) for the things mentioned.
// When a date has nothing, the nearest conversation days either side are returned so the answer can be useful, not just "no".

export type Turn = {
  threadId: string;
  threadTitle: string | null;
  question: MessageRow;
  answer: MessageRow | null;
  sources: SourceRow[];
  facts: FactRow[];
};

export type NearestDay = { label: string; isoDate: string; turns: number; firstQuestion: string };

export type CandidateHit = {
  candidate: DateCandidate;
  turns: Turn[];
  nearestBefore?: NearestDay;
  nearestAfter?: NearestDay;
};

export type Memory = {
  /** Memory was consulted for this message (a past date reference or a recall cue). If false, no block is rendered. */
  attempted: boolean;
  /** False when the user has no stored messages outside the current thread: a brand-new user. */
  userHasHistory: boolean;
  ranges: Array<{ ref: ResolvedReference; hits: CandidateHit[] }>;
  topicWords: string[];
  topical: Turn[];
  entityFacts: FactRow[];
  ms: number;
};

export type RetrieveInput = {
  userId: string;
  threadId: string;
  text: string;
  refs: ResolvedReference[];
  nowMs: number;
  tz: string;
};

const MAX_TURNS_PER_DAY = 8;
const MAX_TOPICAL = 4;

// Words that carry no topic: grammar, the act of asking, and the time vocabulary the resolver already consumed.
const STOP = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its just me my of on or our " +
    "so than that the their them then there these they this to us was we were what when where which who why will with would you your " +
    "ask asked asking answer answers answered tell told said say gave give show showed mention mentioned discuss discussed talk talked " +
    "recommend recommended suggest suggested compare compared shortlist shortlisted pick picked choose chose decide decided look looked " +
    "remember recall question questions conversation conversations chat earlier before previous previously since still correct right " +
    "true valid today yesterday tomorrow tonight morning afternoon evening week weeks month months year years day days ago last next " +
    "past ago any anything update updated change changed changes new now current currently same again also please thanks thank hi hello " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october " +
    "november december jan feb mar apr jun jul aug sep sept oct nov dec has had about some one two three four five six seven eight nine ten " +
    "tool tools thing things stuff more most much many other another get got make made need needs want wants"
  ).split(/\s+/),
);

export function topicWordsOf(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9+#.-]*[a-z0-9+#]|[a-z]/g) ?? []) {
    const w = raw.replace(/^[.-]+|[.-]+$/g, "");
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out.slice(0, 8);
}

type Row = MessageRow & { rid: number };

const turnsInRange = (userId: string, threadId: string, startMs: number, endMs: number): Row[] =>
  db()
    .prepare(
      `SELECT rowid AS rid, * FROM messages
       WHERE user_id = ? AND role = 'user' AND thread_id != ? AND created_at >= ? AND created_at < ?
       ORDER BY created_at, rowid LIMIT ?`,
    )
    .all(userId, threadId, startMs, endMs, MAX_TURNS_PER_DAY + 1) as Row[];

function answerAfter(q: Row): MessageRow | null {
  return (
    (db()
      .prepare(
        `SELECT * FROM messages WHERE thread_id = ? AND role = 'assistant' AND rowid > ?
         AND rowid < COALESCE((SELECT MIN(rowid) FROM messages WHERE thread_id = ? AND role = 'user' AND rowid > ?), 9223372036854775807)
         ORDER BY rowid LIMIT 1`,
      )
      .get(q.thread_id, q.rid, q.thread_id, q.rid) as MessageRow | undefined) ?? null
  );
}

function questionBefore(rowid: number, threadId: string): Row | null {
  return (
    (db()
      .prepare("SELECT rowid AS rid, * FROM messages WHERE thread_id = ? AND role = 'user' AND rowid < ? ORDER BY rowid DESC LIMIT 1")
      .get(threadId, rowid) as Row | undefined) ?? null
  );
}

function buildTurns(questions: Row[]): Turn[] {
  const pairs = questions.map((q) => ({ q, a: answerAfter(q) }));
  const answerIds = pairs.flatMap((p) => (p.a ? [p.a.id] : []));
  const sources = getSourcesForMessages(answerIds);
  const facts = getFactsForMessages(answerIds);
  const titles = new Map<string, string | null>();
  for (const { q } of pairs) {
    if (!titles.has(q.thread_id)) {
      titles.set(q.thread_id, (db().prepare("SELECT title FROM threads WHERE id = ?").get(q.thread_id) as { title: string | null } | undefined)?.title ?? null);
    }
  }
  return pairs.map(({ q, a }) => ({
    threadId: q.thread_id,
    threadTitle: titles.get(q.thread_id) ?? null,
    question: q,
    answer: a,
    sources: a ? sources.filter((s) => s.message_id === a.id) : [],
    facts: a ? facts.filter((f) => f.message_id === a.id) : [],
  }));
}

function nearestDay(userId: string, threadId: string, tz: string, direction: "before" | "after", pivotMs: number): NearestDay | undefined {
  const row = (
    direction === "before"
      ? db().prepare("SELECT created_at FROM messages WHERE user_id = ? AND role = 'user' AND thread_id != ? AND created_at < ? ORDER BY created_at DESC LIMIT 1")
      : db().prepare("SELECT created_at FROM messages WHERE user_id = ? AND role = 'user' AND thread_id != ? AND created_at >= ? ORDER BY created_at ASC LIMIT 1")
  ).get(userId, threadId, pivotMs) as { created_at: number } | undefined;
  if (!row) return undefined;
  const day = DateTime.fromMillis(row.created_at, { zone: tz }).startOf("day");
  const qs = turnsInRange(userId, threadId, day.toMillis(), day.plus({ days: 1 }).startOf("day").toMillis());
  return {
    label: day.toFormat("ccc d LLL yyyy"),
    isoDate: day.toFormat("yyyy-MM-dd"),
    turns: Math.min(qs.length, MAX_TURNS_PER_DAY),
    firstQuestion: qs[0]?.content.replace(/\s+/g, " ").slice(0, 120) ?? "",
  };
}

/** FTS5 query: every topic word, OR-ed, each quoted so punctuation can never be read as syntax. */
function ftsQuery(words: string[]): string {
  return words.map((w) => `"${w.replace(/"/g, "")}"`).join(" OR ");
}

export function retrieveMemory(input: RetrieveInput): Memory {
  const started = performance.now();
  const { userId, threadId, refs, nowMs, tz } = input;

  const userHasHistory = !!db().prepare("SELECT 1 FROM messages WHERE user_id = ? AND thread_id != ? LIMIT 1").get(userId, threadId);
  const topicWords = topicWordsOf(input.text);

  // 1. date ranges. Future references cannot have history. "Today" next to a real past date ("what did I ask
  // on 3 Nov, is it still correct today?") is the question's frame, not another day to look up: when any past
  // reference exists, only those are searched. "What did I ask you today?" has none, so today is searched.
  const startOfToday = DateTime.fromMillis(nowMs, { zone: tz }).startOf("day").toMillis();
  const live = refs.filter((r) => !r.future);
  const past = live.filter((r) => r.candidates.some((c) => c.endMs <= startOfToday));
  const ranges: Memory["ranges"] = [];
  const seen = new Set<string>();
  for (const ref of past.length ? past : live) {
    const hits: CandidateHit[] = ref.candidates.map((candidate) => {
      const rows = turnsInRange(userId, threadId, candidate.startMs, candidate.endMs);
      const turns = buildTurns(rows.slice(0, MAX_TURNS_PER_DAY));
      turns.forEach((t) => seen.add(t.question.id));
      const hit: CandidateHit = { candidate, turns };
      if (!rows.length) {
        hit.nearestBefore = nearestDay(userId, threadId, tz, "before", candidate.startMs);
        hit.nearestAfter = nearestDay(userId, threadId, tz, "after", candidate.endMs);
      }
      return hit;
    });
    ranges.push({ ref, hits });
  }

  // 2. topic search, only when the user is plausibly pointing at the past
  let topical: Turn[] = [];
  const pointsAtPast = refersToPast(refs, nowMs, tz) || hasRecallCue(input.text);
  if (userHasHistory && pointsAtPast && topicWords.length) {
    try {
      const hits = db()
        .prepare(
          `SELECT m.rowid AS rid, m.* FROM messages_fts f JOIN messages m ON m.rowid = f.rowid
           WHERE messages_fts MATCH ? AND m.user_id = ? AND m.thread_id != ?
           ORDER BY bm25(messages_fts) LIMIT 16`,
        )
        .all(ftsQuery(topicWords), userId, threadId) as Row[];
      const byQuestion = new Map<string, Row>();
      for (const h of hits) {
        const q = h.role === "user" ? h : questionBefore(h.rid, h.thread_id);
        if (q && !seen.has(q.id) && !byQuestion.has(q.id)) byQuestion.set(q.id, q);
      }
      const turns = buildTurns([...byQuestion.values()]);
      // How many of the user's topic words does this turn contain? Asked of the FTS index itself, word by word, so
      // the stemming is identical to the search that found it ("versions" in the question, "version" in the old
      // answer). A plain substring test here once discarded exactly the conversation the search had found.
      const rowsWith = new Map<string, Set<number>>();
      for (const w of topicWords) {
        const rows = db()
          .prepare("SELECT f.rowid AS rid FROM messages_fts f JOIN messages m ON m.rowid = f.rowid WHERE messages_fts MATCH ? AND m.user_id = ?")
          .all(`"${w.replace(/"/g, "")}"`, userId) as { rid: number }[];
        rowsWith.set(w, new Set(rows.map((r) => r.rid)));
      }
      const ridOf = (id: string) => (db().prepare("SELECT rowid AS rid FROM messages WHERE id = ?").get(id) as { rid: number }).rid;
      const score = (t: Turn) => {
        const ids = [ridOf(t.question.id), ...(t.answer ? [ridOf(t.answer.id)] : [])];
        return topicWords.filter((w) => ids.some((id) => rowsWith.get(w)!.has(id))).length;
      };
      const need = Math.min(2, topicWords.length);
      topical = turns
        .map((t) => ({ t, s: score(t) }))
        .filter((x) => x.s >= need)
        .sort((a, b) => b.s - a.s) // stable: ties keep BM25 order
        .slice(0, MAX_TOPICAL)
        .map((x) => x.t);
    } catch (e) {
      console.error("[memory] topic search failed", e);
    }
  }

  // 3. structured facts about the entities mentioned that are not already attached to a turn above
  let entityFacts: FactRow[] = [];
  if (userHasHistory && pointsAtPast && topicWords.length) {
    const attached = new Set([...ranges.flatMap((r) => r.hits.flatMap((h) => h.turns)), ...topical].flatMap((t) => t.facts.map((f) => f.id)));
    entityFacts = getFactsByEntityWords(userId, topicWords.filter((w) => w.length >= 4)).filter((f) => !attached.has(f.id));
  }

  const attempted = ranges.length > 0 || pointsAtPast;
  return { attempted, userHasHistory, ranges, topicWords, topical, entityFacts, ms: Math.round(performance.now() - started) };
}

/** What gets stored on the trace: ids and counts, not whole transcripts. */
export function summariseMemory(m: Memory) {
  return {
    attempted: m.attempted,
    userHasHistory: m.userHasHistory,
    ms: m.ms,
    topicWords: m.topicWords,
    ranges: m.ranges.map((r) => ({
      phrase: r.ref.phrase,
      hits: r.hits.map((h) => ({
        label: h.candidate.label,
        turns: h.turns.map((t) => t.question.id),
        nearest: [h.nearestBefore?.label, h.nearestAfter?.label].filter(Boolean),
      })),
    })),
    topical: m.topical.map((t) => t.question.id),
    entityFacts: m.entityFacts.length,
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { db } from "../lib/db";
import { ensureThread, insertFacts, insertMessage, newId } from "../lib/db/repo";
import { renderMemoryBlock } from "../lib/memory/context";
import { retrieveMemory, topicWordsOf } from "../lib/memory/retrieve";
import { seedDemoHistory } from "../lib/seed";
import { resolveDates } from "../lib/temporal/resolve";
import { freshDb } from "./helpers";

const TZ = "UTC";
const U = "user-1";
const CURRENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const WED_18 = DateTime.fromISO("2026-11-18T09:00", { zone: TZ }).toMillis();

/** Seeded: CRM chat Mon 16 Nov, Python chat Tue 3 Nov, Postgres chat Tue 10 Nov. "Now" is Wed 18 Nov 2026. */
function seeded() {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: TZ });
}

function ask(text: string, userId = U, nowMs = WED_18) {
  const refs = resolveDates(text, nowMs, TZ);
  const memory = retrieveMemory({ userId, threadId: CURRENT, text, refs, nowMs, tz: TZ });
  return { refs, memory, block: renderMemoryBlock(memory, { tz: TZ, nowMs }) };
}

test("sample 1: 'On Monday we shortlisted 5 CRM tools...' finds that conversation, its sources and facts", () => {
  seeded();
  const { memory, block } = ask("On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?");
  const [thisMonday, lastMonday] = memory.ranges[0].hits;
  assert.equal(thisMonday.candidate.label, "Mon 16 Nov 2026");
  assert.equal(thisMonday.turns.length, 1);
  const turn = thisMonday.turns[0];
  assert.match(turn.question.content, /Shortlist 5 CRM tools/);
  assert.equal(turn.sources.length, 5);
  assert.equal(turn.facts.length, 5);
  assert.equal(lastMonday.turns.length, 0, "the other reading of 'Monday' held nothing");
  assert.ok(lastMonday.nearestAfter, "empty days say where the nearest conversation is");
  assert.match(block!, /HubSpot Sales Hub \| Starter price per seat per month \| \$20 \| as of 2026-11-16/);
  assert.match(block!, /date for searches: 2026-11-16/);
  assert.match(block!, /Mon 9 Nov 2026: NO conversations stored/);
});

test("sample 2: 'What did I ask you on 3 November? Is it still correct today?' finds it and ignores 'today'", () => {
  seeded();
  const { memory, block } = ask("What did I ask you on 3 November? Is your answer still correct today?");
  assert.equal(memory.ranges.length, 1, "'today' is the frame of the question, not a day to look up");
  const turns = memory.ranges[0].hits[0].turns;
  assert.equal(turns.length, 1);
  assert.match(turns[0].question.content, /latest stable Python version/);
  assert.match(block!, /Python \| latest stable version \| 3\.14 \| as of 2026-11-03/);
  assert.doesNotMatch(block!, /Wed 18 Nov 2026: NO conversations/);
});

test("sample 3: 'Last Tuesday I asked about Postgres hosting' checks both readings of 'last Tuesday'", () => {
  seeded();
  const { memory, block } = ask("Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?");
  const [recentTue, lastWeekTue] = memory.ranges[0].hits;
  assert.equal(recentTue.candidate.label, "Tue 17 Nov 2026");
  assert.equal(recentTue.turns.length, 0);
  assert.equal(lastWeekTue.candidate.label, "Tue 10 Nov 2026");
  assert.equal(lastWeekTue.turns.length, 1);
  assert.match(lastWeekTue.turns[0].question.content, /managed Postgres hosting/);
  assert.match(block!, /Neon \| Launch plan price per month \| \$19/);
  assert.match(block!, /Tue 17 Nov 2026: NO conversations stored\. Nearest days with conversations: Mon 16 Nov 2026/);
});

test("the topic finds the conversation even when the user names the wrong day", () => {
  freshDb(DateTime.fromISO("2026-11-19T09:00", { zone: TZ }).toMillis()); // Thursday
  const wednesday = DateTime.fromISO("2026-11-11T10:00", { zone: TZ }).toMillis();
  const t = newId();
  ensureThread(t, U, wednesday, "Postgres");
  insertMessage({ threadId: t, userId: U, role: "user", content: "Compare Postgres hosting options for a small SaaS", createdAt: wednesday, tz: TZ });
  insertMessage({ threadId: t, userId: U, role: "assistant", content: "Neon is $19/month and Supabase is $25/month.", createdAt: wednesday + 20_000, tz: TZ });
  const now = DateTime.fromISO("2026-11-19T09:00", { zone: TZ }).toMillis();
  const { memory, block } = ask("Last Tuesday I asked you about Postgres hosting. Has pricing changed?", U, now);
  assert.ok(memory.ranges[0].hits.every((h) => h.turns.length === 0), "nothing on either Tuesday");
  assert.equal(memory.topical.length, 1);
  assert.match(memory.topical[0].question.content, /Postgres hosting/);
  assert.match(block!, /Tue 17 Nov 2026: NO conversations stored/);
  assert.match(block!, /Conversations matching the topic \(postgres, hosting, pricing\).*any date/);
  assert.match(block!, /### Turn 1: Wed 11 Nov 2026, 10:00/);
});

test("topic matching stems words the same way the index does: 'versions' finds 'version'", () => {
  seeded(); // the Python chat says "version", singular
  const { memory } = ask("On Friday I asked you about Python versions. What did you tell me?");
  assert.equal(memory.topical.length, 1, "found by topic even though the user named the wrong day");
  assert.match(memory.topical[0].question.content, /latest stable Python version/);
  assert.equal(topicWordsOf("Python versions").length, 2, "both words are required to match, and both do");
});

test("a brand-new user asking about the past gets an explicit 'nothing stored at all'", () => {
  freshDb(WED_18);
  const { memory, block } = ask("What did I ask you on 3 November?");
  assert.equal(memory.userHasHistory, false);
  assert.match(block!, /no stored conversations at all/);
  assert.match(block!, /Tue 3 Nov 2026: NO conversations stored\./);
  assert.doesNotMatch(block!, /Nearest days/);
  // The consequence is spelled out, and comes last in the prompt: observed on a weaker model, "nothing stored" alone
  // was not enough to stop it inventing a "Then" column.
  assert.match(block!, /RECORD STATUS: NO EARLIER CONVERSATION WAS FOUND/);
  assert.match(block!, /Do NOT state or imply any earlier answer/);
  assert.ok(block!.trim().endsWith("once the user says what was discussed."), "the directive is the last thing the model reads");
});

test("the 'nothing found' directive appears only when nothing was found", () => {
  seeded();
  const found = ask("What did I ask you on 3 November?");
  assert.doesNotMatch(found.block!, /RECORD STATUS/);
  const missing = ask("What did I ask you on 12 September?");
  assert.match(missing.block!, /RECORD STATUS: NO EARLIER CONVERSATION WAS FOUND/);
  assert.match(missing.block!, /mention the nearest conversations listed above/);
});

test("memory never crosses users", () => {
  seeded();
  const { memory, block } = ask("What did I ask you on 3 November?", "someone-else");
  assert.equal(memory.userHasHistory, false);
  assert.equal(memory.ranges[0].hits[0].turns.length, 0);
  assert.doesNotMatch(block!, /Python/);
});

test("a fresh question does not consult memory at all", () => {
  seeded();
  const { memory, block } = ask("What is the latest Node.js LTS version?");
  assert.equal(memory.attempted, false);
  assert.equal(block, undefined);
});

test("a recall cue with no date still searches by topic; with no match it says so", () => {
  seeded();
  const found = ask("Remember when I asked you about Postgres hosting?");
  assert.equal(found.refs.length, 0);
  assert.equal(found.memory.topical.length, 1);
  assert.match(found.block!, /managed Postgres hosting/);
  const none = ask("Remember when I asked you about kubernetes operators?");
  assert.equal(none.memory.topical.length, 0);
  assert.match(none.block!, /No stored conversation matched/);
});

test("the current thread is not repeated in the memory block (it is already in the conversation)", () => {
  seeded();
  const now = WED_18 + 3_600_000;
  ensureThread(CURRENT, U, now);
  insertMessage({ threadId: CURRENT, userId: U, role: "user", content: "Shortlist 5 CRM tools again", createdAt: now, tz: TZ });
  const { memory } = ask("On Wednesday I asked about CRM tools, remember?", U, now + 60_000);
  const ids = memory.ranges.flatMap((r) => r.hits.flatMap((h) => h.turns.map((t) => t.threadId)));
  assert.ok(!ids.includes(CURRENT));
});

test("hostile punctuation cannot break the full-text query", () => {
  seeded();
  assert.doesNotThrow(() => ask('I asked about "postgres" OR (hosting) NEAR/3 -- ; DROP TABLE messages; earlier'));
  assert.equal((db().prepare("SELECT count(*) c FROM messages").get() as { c: number }).c > 0, true, "the table survived");
});

test("topic words drop grammar, time words and the act of asking", () => {
  assert.deepEqual(topicWordsOf("Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"), ["postgres", "hosting", "pricing"]);
  assert.deepEqual(topicWordsOf("What did I ask you on 3 November?"), []);
});

test("a very long history is cut at turn boundaries and says so", () => {
  freshDb(WED_18);
  const day = DateTime.fromISO("2026-11-16T10:00", { zone: TZ }).toMillis();
  for (let i = 0; i < 8; i++) {
    const t = newId();
    ensureThread(t, U, day + i * 1000, `chat ${i}`);
    insertMessage({ threadId: t, userId: U, role: "user", content: `Question ${i} about databases`, createdAt: day + i * 1000, tz: TZ });
    insertMessage({ threadId: t, userId: U, role: "assistant", content: "x".repeat(3400), createdAt: day + i * 1000 + 500, tz: TZ });
  }
  const { block } = ask("On Monday I asked some questions, what were they?");
  assert.ok(block!.length < 16_000);
  assert.match(block!, /more matching turns? omitted for length/);
  assert.doesNotMatch(block!, /\[answer truncated\]\s*###/); // no half turns
});

test("facts attach to their turn and are not repeated as 'other' facts", () => {
  seeded();
  const { memory } = ask("Has Neon changed their pricing since we talked about Postgres hosting?");
  assert.equal(memory.topical.length, 1);
  assert.ok(memory.topical[0].facts.some((f) => f.entity === "Neon"));
  assert.equal(memory.entityFacts.length, 0);
  // A fact from a different, unmatched message about Neon does show up as an 'other' fact.
  const m = db().prepare("SELECT id FROM messages WHERE role='assistant' AND content LIKE '%Python%'").get() as { id: string };
  insertFacts(m.id, U, WED_18, [{ entity: "Neon", attribute: "free tier storage", value: "0.5 GB", source_url: null }]);
  const again = ask("Has Neon changed their pricing since we talked about Postgres hosting?");
  assert.equal(again.memory.entityFacts.length, 1);
  assert.match(again.block!, /Neon \| free tier storage \| 0\.5 GB/);
});

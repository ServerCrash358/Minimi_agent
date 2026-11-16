import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { refersToPast, resolveDates } from "../lib/temporal/resolve";

const at = (iso: string, zone: string) => DateTime.fromISO(iso, { zone }).toMillis();
const labels = (text: string, now: number, tz: string) => resolveDates(text, now, tz).flatMap((r) => r.candidates.map((c) => c.label));

// Anchor dates in Nov 2026: Mon 9, Mon 16, Wed 18, Thu 19.
const MON_16 = at("2026-11-16T09:00", "UTC");
const WED_18 = at("2026-11-18T09:00", "UTC");
const THU_19 = at("2026-11-19T09:00", "UTC");

test("'last Tuesday' collapses to one date when both readings agree, two when they do not", () => {
  // Monday 16th: the most recent Tuesday and Tuesday of last calendar week are the same day.
  assert.deepEqual(labels("Last Tuesday I asked you about Postgres hosting", MON_16, "UTC"), ["Tue 10 Nov 2026"]);
  assert.equal(resolveDates("Last Tuesday I asked about Postgres", MON_16, "UTC")[0].ambiguous, false);
  // Thursday 19th: the most recent Tuesday is the 17th, last week's Tuesday is the 10th.
  const r = resolveDates("Last Tuesday I asked about Postgres", THU_19, "UTC");
  assert.deepEqual(r[0].candidates.map((c) => c.label), ["Tue 17 Nov 2026", "Tue 10 Nov 2026"]);
  assert.equal(r[0].ambiguous, true);
  assert.match(r[0].note ?? "", /ambiguous/);
});

test("bare weekday after a recall cue: this week's and last week's are both candidates", () => {
  const r = resolveDates("On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any changed pricing?", WED_18, "UTC");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].candidates.map((c) => c.label), ["Mon 16 Nov 2026", "Mon 9 Nov 2026"]);
  assert.equal(r[0].ambiguous, true);
});

test("a bare weekday said ON that weekday also includes today", () => {
  const r = resolveDates("On Monday we shortlisted 5 CRM tools", MON_16, "UTC");
  assert.deepEqual(r[0].candidates.map((c) => c.label), ["Mon 9 Nov 2026", "Mon 2 Nov 2026", "Mon 16 Nov 2026"]);
});

test("a bare weekday with no talk of the past is not a memory reference", () => {
  assert.deepEqual(resolveDates("Is the Apple store open on Saturday?", WED_18, "UTC"), []);
  assert.deepEqual(resolveDates("Shortlist 5 CRM tools for a 20-person sales team", WED_18, "UTC"), []);
});

test("explicit dates: year inferred as the most recent past occurrence", () => {
  assert.deepEqual(labels("What did I ask you on 3 November?", MON_16, "UTC"), ["Tue 3 Nov 2026"]);
  const feb = at("2026-02-10T09:00", "UTC");
  const r = resolveDates("What did I ask you on 3 November?", feb, "UTC");
  assert.deepEqual(r[0].candidates.map((c) => c.label), ["Mon 3 Nov 2025"]);
  assert.match(r[0].note ?? "", /No year given/);
  assert.deepEqual(labels("what did I ask on Nov 3rd 2025", feb, "UTC"), ["Mon 3 Nov 2025"]);
  assert.deepEqual(labels("asked you on 2026-11-03", MON_16, "UTC"), ["Tue 3 Nov 2026"]);
});

test("numeric dates are ambiguous between day-first and month-first", () => {
  const r = resolveDates("What did I ask you on 3/11?", MON_16, "UTC");
  assert.equal(r.length, 1);
  assert.equal(r[0].ambiguous, true);
  assert.deepEqual(new Set(r[0].candidates.map((c) => c.label)), new Set(["Tue 3 Nov 2026", "Wed 11 Mar 2026"]));
  // 25/11 can only be day-first.
  assert.deepEqual(labels("asked you on 25/10", MON_16, "UTC"), ["Sun 25 Oct 2026"]);
});

test("'Monday 9 Nov' is one reference, not two", () => {
  const r = resolveDates("On Monday 9 Nov I asked about CRMs", WED_18, "UTC");
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].candidates.map((c) => c.label), ["Mon 9 Nov 2026"]);
});

test("relative days, weeks and months", () => {
  assert.deepEqual(labels("what did I ask yesterday", WED_18, "UTC"), ["Tue 17 Nov 2026"]);
  assert.deepEqual(labels("what did I ask the day before yesterday", WED_18, "UTC"), ["Mon 16 Nov 2026"]);
  assert.deepEqual(labels("what did I ask 3 days ago", WED_18, "UTC"), ["Sun 15 Nov 2026"]);
  assert.deepEqual(labels("what did I ask two weeks ago", MON_16, "UTC"), ["Fri 30 Oct to Thu 5 Nov 2026"]); // Mon 2 Nov, three days either side
  assert.deepEqual(labels("what did I ask last month", MON_16, "UTC"), ["Thu 1 Oct to Sat 31 Oct 2026"]);
});

test("'last week' is ambiguous (calendar week vs past seven days) unless they coincide", () => {
  const wed = resolveDates("what did we discuss last week", WED_18, "UTC")[0];
  assert.deepEqual(wed.candidates.map((c) => c.label), ["Mon 9 Nov to Sun 15 Nov 2026", "Wed 11 Nov to Tue 17 Nov 2026"]);
  assert.equal(wed.ambiguous, true);
  const mon = resolveDates("what did we discuss last week", MON_16, "UTC")[0];
  assert.equal(mon.candidates.length, 1);
  assert.equal(mon.ambiguous, false);
});

test("future references are flagged and do not count as past", () => {
  const r = resolveDates("remind me next Friday", WED_18, "UTC");
  assert.equal(r[0].future, true);
  assert.equal(refersToPast(r, WED_18, "UTC"), false);
  assert.equal(refersToPast(resolveDates("what did I ask yesterday", WED_18, "UTC"), WED_18, "UTC"), true);
  assert.equal(refersToPast(resolveDates("what did I ask today", WED_18, "UTC"), WED_18, "UTC"), false);
});

test("the user's timezone decides what 'yesterday' means, not the server's", () => {
  // 22:00 UTC on the 16th is 03:30 on the 17th in Kolkata. For that user, yesterday is the 16th.
  const now = at("2026-11-16T22:00", "UTC");
  const ist = resolveDates("what did I ask yesterday", now, "Asia/Kolkata")[0].candidates[0];
  assert.equal(ist.label, "Mon 16 Nov 2026");
  assert.equal(ist.startMs, at("2026-11-16T00:00", "Asia/Kolkata"));
  assert.equal(ist.endMs, at("2026-11-17T00:00", "Asia/Kolkata"));
  // Same instant, UTC user: yesterday is the 15th.
  assert.equal(resolveDates("what did I ask yesterday", now, "UTC")[0].candidates[0].label, "Sun 15 Nov 2026");
  // And Los Angeles is still on the 16th, so yesterday is the 15th there too.
  assert.equal(resolveDates("what did I ask yesterday", now, "America/Los_Angeles")[0].candidates[0].label, "Sun 15 Nov 2026");
});

test("DST: the day the clocks go back is 25 hours long, and ranges still tile the calendar", () => {
  const now = at("2026-11-02T10:00", "America/New_York"); // Monday after US DST ended (Sun 1 Nov 2026)
  const sunday = resolveDates("what did I ask yesterday", now, "America/New_York")[0].candidates[0];
  assert.equal(sunday.label, "Sun 1 Nov 2026");
  assert.equal((sunday.endMs - sunday.startMs) / 3_600_000, 25);
  const saturday = resolveDates("what did I ask 2 days ago", now, "America/New_York")[0].candidates[0];
  assert.equal(saturday.endMs, sunday.startMs, "adjacent days share a boundary: nothing falls in a gap");
});

test("junk and edge input", () => {
  assert.deepEqual(resolveDates("", MON_16, "UTC"), []);
  assert.deepEqual(resolveDates("31 November", MON_16, "UTC"), [], "impossible dates are dropped");
  assert.throws(() => resolveDates("yesterday", MON_16, "Not/AZone"), /Invalid timezone/);
});

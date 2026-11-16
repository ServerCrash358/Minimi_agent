import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { classifyIntent } from "../lib/agent/intent";
import { retrieveMemory } from "../lib/memory/retrieve";
import { seedDemoHistory } from "../lib/seed";
import { seedHoldout } from "../lib/eval/holdout";
import { resolveDates } from "../lib/temporal/resolve";
import { freshDb } from "./helpers";

const WED_18 = DateTime.fromISO("2026-11-18T09:00", { zone: "UTC" }).toMillis();
const U = "intent-user";

function kind(text: string) {
  const refs = resolveDates(text, WED_18, "UTC");
  const memory = retrieveMemory({ userId: U, threadId: "current-thread", text, refs, nowMs: WED_18, tz: "UTC" });
  return classifyIntent(text, memory).kind;
}

test("intent: asking WHAT was said, with the conversation found, is recall (tools off)", () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  seedHoldout(U, WED_18, "UTC");
  for (const q of [
    "In an earlier chat I asked you about Postgres hosting. Which provider did you say was cheapest to start with?",
    "On Friday I asked you about Python versions. What did you tell me?",
    "What did I ask you on 3 November?",
    "Last Friday I asked you about helpdesk tools. What did you recommend?",
  ]) assert.equal(kind(q), "recall", q);
});

test("intent: asking whether it changed or still holds is recheck", () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  seedHoldout(U, WED_18, "UTC");
  for (const q of [
    "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
    "What did I ask you on 3 November? Is your answer still correct today?",
    "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
    "Two weeks ago I asked you about vector database hosting. Has any pricing changed since then?",
  ]) assert.equal(kind(q), "recheck", q);
});

test("intent: explanatory questions with no product name are conceptual", () => {
  freshDb(WED_18);
  for (const q of [
    "What is a database index and when would I use one?",
    "Explain the difference between a left join and an inner join.",
    "How does garbage collection work?",
    "Why is the sky blue?",
  ]) assert.equal(kind(q), "conceptual", q);
});

test("intent: anything that could be about the live world, or names a product, keeps search on", () => {
  freshDb(WED_18);
  for (const q of [
    "What is the latest Node.js LTS version?",
    "What is the latest stable version of Go?",
    "What does Notion cost?",
    "What is Kubernetes pricing on Google Cloud?",
    "Compare Linear, Jira and Asana for a 10-person team.",
    "Has Supabase changed its Pro plan price recently?",
    "Explain how Stripe handles refunds today.",
    "What is the weather in Pune?",
    "Who won the match?",
  ]) assert.equal(kind(q), "open", q);
});

test("intent: referring to the past with no record found is open, so the model can still help", () => {
  freshDb(WED_18);
  assert.equal(kind("What did I ask you on 12 September?"), "open");
  assert.equal(kind("Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"), "open");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { hostOf, planPrefetch } from "../lib/agent/prefetch";
import { retrieveMemory } from "../lib/memory/retrieve";
import { resolveDates } from "../lib/temporal/resolve";
import { seedDemoHistory } from "../lib/seed";
import { seedHoldout } from "../lib/eval/holdout";
import { freshDb } from "./helpers";

const WED_18 = DateTime.fromISO("2026-11-18T09:00", { zone: "UTC" }).toMillis();
const U = "prefetch-user";

function plan(text: string) {
  const refs = resolveDates(text, WED_18, "UTC");
  const memory = retrieveMemory({ userId: U, threadId: "current", text, refs, nowMs: WED_18, tz: "UTC" });
  return planPrefetch(memory, "UTC", U);
}

test("hostOf strips www and rejects junk", () => {
  assert.equal(hostOf("https://www.HubSpot.com/pricing/sales"), "hubspot.com");
  assert.equal(hostOf("https://devguide.python.org/versions/"), "devguide.python.org");
  assert.equal(hostOf("not a url"), null);
});

test("prefetch plan: one site search per vendor page the old answer used, plus one dated news search", () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  const p = plan("On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing since?");
  const sites = p.filter((s) => s.site).map((s) => s.site);
  assert.deepEqual(new Set(sites), new Set(["hubspot.com", "pipedrive.com", "zoho.com", "salesforce.com", "freshworks.com"]));
  const hub = p.find((s) => s.site === "hubspot.com")!;
  assert.match(hub.query, /HubSpot Sales Hub pricing plans/);
  const news = p.filter((s) => !s.site);
  assert.equal(news.length, 1);
  assert.equal(news[0].since, "2026-11-16", "dated from the day of the old answer");
  assert.match(news[0].query, /HubSpot Sales Hub.*Pipedrive.*pricing changes/);
});

test("prefetch plan: a version question searches for the latest release, not pricing", () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  const p = plan("What did I ask you on 3 November? Is your answer still correct today?");
  assert.equal(p[0].site, "devguide.python.org");
  assert.match(p[0].query, /Python latest stable release/);
  assert.match(p[p.length - 1].query, /new release announcements/);
});

test("prefetch plan: held-out history works the same way, and nothing is planned without recalled facts", () => {
  freshDb(WED_18);
  seedHoldout(U, WED_18, "UTC");
  const p = plan("Two weeks ago I asked you about vector database hosting. Has any pricing changed since then?");
  assert.deepEqual(new Set(p.filter((s) => s.site).map((s) => s.site)), new Set(["pinecone.io", "qdrant.tech", "weaviate.io"]));
  assert.deepEqual(plan("What did I ask you on 12 September? Has anything changed?"), [], "no record, no plan");
});

test("prefetch plan: capped at six vendor sites", () => {
  freshDb(WED_18);
  seedDemoHistory({ userId: U, nowMs: WED_18, tz: "UTC" });
  const p = plan("On Monday we shortlisted 5 CRM tools. Has any of them changed since?");
  assert.ok(p.filter((s) => s.site).length <= 6);
});

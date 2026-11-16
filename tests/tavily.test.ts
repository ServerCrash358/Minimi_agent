import { test } from "node:test";
import assert from "node:assert/strict";
import { SearchError, isoDate, normaliseSite, tavilySearch } from "../lib/search/tavily";
import { cacheGet, cacheSet } from "../lib/search/cache";
import { setNowOverride } from "../lib/clock";
import { freshDb } from "./helpers";

const ok = (results: unknown[]) => new Response(JSON.stringify({ results }), { status: 200 });

test("normaliseSite strips protocol, www and path; rejects junk", () => {
  assert.equal(normaliseSite("https://www.HubSpot.com/pricing?x=1"), "hubspot.com");
  assert.equal(normaliseSite("neon.tech"), "neon.tech");
  assert.equal(normaliseSite("not a domain"), undefined);
  assert.equal(normaliseSite(""), undefined);
});

test("open search: excerpts, no raw content, since becomes start_date", async () => {
  let sent: Record<string, unknown> = {};
  const fetchImpl = (async (_u: unknown, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return ok([{ title: "T", url: "https://a.com/x", content: "hello", published_date: "2026-11-01" }]);
  }) as typeof fetch;
  const hits = await tavilySearch({ query: "q", since: "2026-11-01" }, { apiKey: "k", fetchImpl });
  assert.equal(sent.start_date, "2026-11-01");
  assert.equal(sent.include_raw_content, undefined);
  assert.equal(sent.filter_by_published_date, undefined, "undated pricing pages must not be filtered out");
  assert.deepEqual(hits, [{ title: "T", url: "https://a.com/x", content: "hello", publishedAt: "2026-11-01" }]);
});

test("publish dates are normalised to YYYY-MM-DD", () => {
  assert.equal(isoDate("Sun, 30 Jun 2024 00:00:00 GMT"), "2024-06-30");
  assert.equal(isoDate("2026-11-10"), "2026-11-10");
  assert.equal(isoDate("garbage"), null);
  assert.equal(isoDate(null), null);
});

test("site search: restricted to the domain, asks for the page body", async () => {
  let sent: Record<string, unknown> = {};
  const fetchImpl = (async (_u: unknown, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return ok([{ title: "Pricing", url: "https://x.com/pricing", content: "short", raw_content: "Pro $25 / month" }]);
  }) as typeof fetch;
  const hits = await tavilySearch({ query: "pricing", site: "https://www.x.com/anything" }, { apiKey: "k", fetchImpl });
  assert.deepEqual(sent.include_domains, ["x.com"]);
  assert.equal(sent.include_raw_content, "markdown");
  assert.equal("max_age_hours" in sent, false, "measured live: max_age_hours returned fewer, worse pages");
  assert.match(hits[0].content, /Pro \$25/);
});

test("the same page under tracking parameters or ?variants becomes one source", async () => {
  const fetchImpl = (async () =>
    ok([
      { title: "Pricing", url: "https://supabase.com/pricing?ref=scrimba.com", content: "a" },
      { title: "Pricing", url: "https://www.supabase.com/pricing/?utm_source=x&ref=y#plans", content: "b" },
      { title: "Compare", url: "https://supabase.com/pricing?compare-plans=", content: "c" },
      { title: "Docs", url: "https://supabase.com/docs/billing", content: "d" },
    ])) as unknown as typeof fetch;
  const hits = await tavilySearch({ query: "pricing", site: "supabase.com" }, { apiKey: "k", fetchImpl });
  assert.deepEqual(hits.map((h) => h.url), ["https://supabase.com/pricing", "https://supabase.com/docs/billing"]);
});

test("errors are typed so the tool can tell the model what failed", async () => {
  const status = (s: number) => (async () => new Response("", { status: s })) as unknown as typeof fetch;
  await assert.rejects(tavilySearch({ query: "q" }, { apiKey: "k", fetchImpl: status(401) }), (e: SearchError) => e.kind === "auth");
  await assert.rejects(tavilySearch({ query: "q" }, { apiKey: "k", fetchImpl: status(429) }), (e: SearchError) => e.kind === "rate_limit");
  await assert.rejects(tavilySearch({ query: "q" }, { apiKey: "k", fetchImpl: status(500) }), (e: SearchError) => e.kind === "http");
  const boom = (async () => {
    throw Object.assign(new Error("slow"), { name: "TimeoutError" });
  }) as unknown as typeof fetch;
  await assert.rejects(tavilySearch({ query: "q" }, { apiKey: "k", fetchImpl: boom }), (e: SearchError) => e.kind === "timeout");
  await assert.rejects(tavilySearch({ query: "q" }, { apiKey: "" }), (e: SearchError) => e.kind === "config");
});

test("cache: same query same day hits; next day misses; empty results are not cached", () => {
  freshDb(Date.UTC(2026, 10, 16, 9));
  const p = { query: "  Neon Pricing ", site: "neon.tech" };
  assert.equal(cacheGet(p), null);
  cacheSet(p, []);
  assert.equal(cacheGet(p), null);
  const hits = [{ title: "t", url: "https://neon.tech/pricing", content: "c", publishedAt: null }];
  cacheSet(p, hits);
  assert.deepEqual(cacheGet({ query: "neon pricing", site: "neon.tech" }), hits);
  setNowOverride(Date.UTC(2026, 10, 17, 9));
  assert.equal(cacheGet(p), null, "a price can change overnight: yesterday's result must not be served");
});

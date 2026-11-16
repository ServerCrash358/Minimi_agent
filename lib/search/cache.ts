import { createHash } from "node:crypto";
import { db } from "../db";
import { nowMs } from "../clock";
import type { SearchHit, SearchParams } from "./tavily";

// Cache by (query, site, since, day). The day is part of the key on purpose: a result
// is reusable all day (five users asking about the same five CRMs cost five searches,
// not twenty-five) but never the next day, when a price may have changed.

function key(p: SearchParams): string {
  const day = new Date(nowMs()).toISOString().slice(0, 10);
  const norm = JSON.stringify([p.query.trim().toLowerCase().replace(/\s+/g, " "), p.site ?? "", p.since ?? "", day]);
  return createHash("sha1").update(norm).digest("hex");
}

export function cacheGet(p: SearchParams): SearchHit[] | null {
  const row = db().prepare("SELECT json FROM search_cache WHERE key = ?").get(key(p)) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as SearchHit[]) : null;
}

export function cacheSet(p: SearchParams, hits: SearchHit[]) {
  if (!hits.length) return; // never cache an empty or failed search
  db()
    .prepare("INSERT OR REPLACE INTO search_cache(key, created_at, json) VALUES (?,?,?)")
    .run(key(p), nowMs(), JSON.stringify(hits));
  // Keep the table small: entries from earlier days can never be hit again.
  db().prepare("DELETE FROM search_cache WHERE created_at < ?").run(nowMs() - 3 * 86_400_000);
}

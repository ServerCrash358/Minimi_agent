// Thin Tavily client. No SDK: one POST, explicit timeout, normalised results.
//
// Two modes, because they answer different questions:
//  - open web search: short excerpts, 5 results. Good for news, releases, "what changed".
//  - vendor-site search (`site` set): restricted to one domain, returns the page body so
//    prices on a pricing page are actually in the text. Date filters cannot do this job:
//    pricing pages are edited in place and keep their old publish date (Tavily's own docs say
//    so), so a `since` filter silently drops exactly the page we need.
//
// Measured against the live API (Nov 2026), which shaped three choices below:
//  - `max_age_hours` made things worse (1 irrelevant page, no body vs. the real /pricing page),
//    so it is not sent.
//  - the same page often comes back several times as /pricing?ref=..., so URLs are canonicalised
//    and de-duplicated.
//  - prices sit in the first ~2k characters of the main plan tables, so an 8k window is enough.

export type SearchHit = {
  title: string;
  url: string;
  content: string;
  publishedAt: string | null;
};

export type SearchParams = {
  query: string;
  /** Restrict to a single domain, e.g. "hubspot.com". */
  site?: string;
  /** YYYY-MM-DD. Only used to rank/limit by publish date; undated pages are kept. */
  since?: string;
};

export class SearchError extends Error {
  constructor(
    message: string,
    readonly kind: "config" | "auth" | "rate_limit" | "timeout" | "http" | "network",
  ) {
    super(message);
  }
}

export type SearchOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const ENDPOINT = "https://api.tavily.com/search";
const OPEN_EXCERPT_CHARS = 1200;
const SITE_PAGE_CHARS = 8000;

/** "https://www.HubSpot.com/pricing" -> "hubspot.com". Returns undefined if it is not a hostname. */
export function normaliseSite(site?: string): string | undefined {
  if (!site) return undefined;
  const host = site
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : undefined;
}

const TRACKING = /^(utm_.*|ref|ref_src|gclid|fbclid|mc_cid|mc_eid)$/i;

/** Drop tracking parameters and fragments so the same page is one source, not three. */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

function dedupeKey(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/** Tavily sends "Sun, 30 Jun 2024 00:00:00 GMT"; store and show YYYY-MM-DD. Unparseable -> null. */
export function isoDate(raw?: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + " [truncated]" : t;
}

export async function tavilySearch(params: SearchParams, opts: SearchOptions = {}): Promise<SearchHit[]> {
  const apiKey = opts.apiKey ?? process.env.TAVILY_API_KEY;
  if (!apiKey) throw new SearchError("TAVILY_API_KEY is not set (see .env.example).", "config");
  const doFetch = opts.fetchImpl ?? fetch;
  const site = normaliseSite(params.site);

  const body: Record<string, unknown> = {
    query: params.query,
    search_depth: "basic",
    // Site mode asks for one extra: duplicates of the same page are removed below.
    max_results: site ? 4 : 5,
    include_answer: false,
    include_published_date: true,
  };
  if (site) {
    body.include_domains = [site];
    body.include_raw_content = "markdown";
  }
  if (params.since) body.start_date = params.since;

  let res: Response;
  try {
    res = await doFetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? (site ? 10_000 : 8000)),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") throw new SearchError("The search timed out.", "timeout");
    throw new SearchError(`Could not reach the search service: ${(e as Error)?.message ?? e}`, "network");
  }
  if (res.status === 401 || res.status === 403) throw new SearchError("The search API key was rejected.", "auth");
  if (res.status === 429) throw new SearchError("The search service is rate limiting us.", "rate_limit");
  if (!res.ok) throw new SearchError(`The search service returned HTTP ${res.status}.`, "http");

  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string | null; published_date?: string | null }>;
  };

  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const r of json.results ?? []) {
    if (!r.url) continue;
    const url = cleanUrl(r.url);
    const key = dedupeKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      title: r.title?.trim() || url,
      url,
      content: site ? clip(r.raw_content || r.content || "", SITE_PAGE_CHARS) : clip(r.content || "", OPEN_EXCERPT_CHARS),
      publishedAt: isoDate(r.published_date),
    });
  }
  return hits.slice(0, site ? 3 : 5);
}

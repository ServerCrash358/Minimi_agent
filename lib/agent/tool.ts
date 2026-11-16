import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { nowMs } from "../clock";
import { cacheGet, cacheSet } from "../search/cache";
import { SearchError, normaliseSite, tavilySearch, type SearchHit, type SearchParams } from "../search/tavily";
import type { ChatMessage, SearchToolOutput, SourceData } from "../types";
import type { Trace } from "../trace";

export type CollectedSource = SourceData & { fetchedAt: number; snippet: string };

/** Numbers sources across every search in one turn, so [n] in the answer is unambiguous. Dedupes by URL. */
export class SourceCollector {
  private byUrl = new Map<string, CollectedSource>();
  add(hit: SearchHit, fetchedAt: number): CollectedSource {
    const existing = this.byUrl.get(hit.url);
    if (existing) return existing;
    const src: CollectedSource = {
      n: this.byUrl.size + 1,
      url: hit.url,
      title: hit.title,
      publishedAt: hit.publishedAt,
      fetchedAt,
      snippet: hit.content.slice(0, 400),
    };
    this.byUrl.set(hit.url, src);
    return src;
  }
  all(): CollectedSource[] {
    return [...this.byUrl.values()];
  }
}

export type SearchFn = (p: SearchParams) => Promise<SearchHit[]>;

export type ToolContext = {
  sources: SourceCollector;
  trace: Trace;
  writer: UIMessageStreamWriter<ChatMessage>;
  /** Injectable so tests and the eval harness can run without the network. */
  search?: SearchFn;
};

// Five vendors x (pricing page + news) = 10 in one parallel step is the intended heavy case, so the cap sits above it.
const MAX_SEARCHES_PER_TURN = 12;

/**
 * Models habitually write "site:neon.tech/pricing" inside the query, as they would for Google. Tavily ignores
 * operators, so that search would run on the open web. Lift the operator into the real `site` parameter.
 * (Observed on the live model: 8 of 8 vendor searches in one turn did this.)
 */
export function splitSiteOperator(i: { query: string; site?: string; since?: string }) {
  const m = i.query.match(/(?:^|\s)site:(\S+)/i);
  if (!m) return i;
  const query = i.query.replace(m[0], " ").replace(/\s+/g, " ").trim();
  return { query: query.length >= 2 ? query : i.query, site: i.site ?? m[1], since: i.since };
}

export function makeSearchTool(ctx: ToolContext) {
  const run: SearchFn = ctx.search ?? ((p) => tavilySearch(p));

  return tool({
    description:
      "Search the live web. Returns numbered results with page excerpts and dates. " +
      "Use `site` (a vendor domain like hubspot.com) to read that vendor's own pricing, plan, docs or changelog pages: it returns the page body. " +
      "Use `since` (YYYY-MM-DD) only for news and announcements, never for pricing pages. " +
      "Call several searches in parallel when the question covers several items.",
    inputSchema: z.object({
      query: z.string().min(2).max(300).describe("Plain-words search query, e.g. 'HubSpot Sales Hub pricing per seat'. No operators: put the domain in `site`, not 'site:...' here."),
      site: z.string().max(100).optional().describe("Restrict to one domain, e.g. 'hubspot.com' (a bare domain, no path or protocol)"),
      since: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Only results published on/after this date (YYYY-MM-DD). For news and announcements."),
    }),
    async execute(input): Promise<SearchToolOutput> {
      const { query, site, since } = splitSiteOperator(input);
      const params: SearchParams = { query, site: normaliseSite(site), since };
      const started = performance.now();
      const entry = { query, site: params.site, since, cached: false, ms: 0, results: 0 } as Trace["searches"][number];
      ctx.trace.searches.push(entry);

      if (ctx.trace.searches.length > MAX_SEARCHES_PER_TURN) {
        entry.error = "search limit reached";
        return { query, error: "Search limit for this answer reached. Answer with what you have and say what is unverified.", results: [] };
      }

      try {
        let hits = cacheGet(params);
        entry.cached = hits !== null;
        if (!hits) {
          hits = await run(params);
          cacheSet(params, hits);
        }
        const fetchedAt = nowMs();
        const results = hits.map((h) => {
          const src = ctx.sources.add(h, fetchedAt);
          // Stream each source as soon as it exists so [n] links work while the answer is still typing.
          ctx.writer.write({
            type: "data-source",
            id: `src-${src.n}`,
            data: { n: src.n, url: src.url, title: src.title, publishedAt: src.publishedAt },
          });
          // `cite` is the exact string to write after a claim. Models follow a literal better than "use the number n".
          return { n: src.n, cite: `[${src.n}]`, title: h.title, url: h.url, date: h.publishedAt, excerpt: h.content };
        });
        entry.results = results.length;
        entry.ms = Math.round(performance.now() - started);
        if (!results.length) {
          return { query, error: "No results found. Try different wording, or say this could not be verified.", results: [] };
        }
        return { query, cached: entry.cached, results };
      } catch (e) {
        entry.ms = Math.round(performance.now() - started);
        const msg = e instanceof SearchError ? e.message : `Search failed: ${(e as Error)?.message ?? e}`;
        entry.error = msg;
        // Returned to the model, not thrown: it can still answer and must say what it could not verify.
        return { query, error: `${msg} Tell the user this part could not be verified.`, results: [] };
      }
    },
  });
}

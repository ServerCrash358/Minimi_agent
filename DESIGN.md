# Design

**The insight.** All three sample questions are about *memory over time*, not search. Each needs four steps that a plain "LLM + search tool" gets wrong: (1) resolve the date ("Monday", "last Tuesday", "3 November") in the user's timezone; (2) recall exactly what was said then, not a fuzzy summary; (3) re-check it against the live web, including pricing pages that change without an announcement; (4) answer as a diff, and say plainly when there is no record. The architecture is arranged around those four steps.

## 1. How it works

One function, `runTurn()` ([lib/agent/run.ts](lib/agent/run.ts)), used by the API route, the eval harness and the tests:

1. **Resolve dates**: chrono-node plus calendar rules, in the user's timezone, no model call. Ambiguity is kept, not guessed: "Monday" yields this week's and last week's, "last Tuesday" the most recent and last calendar week's, `3/11` both readings.
2. **Retrieve** from SQLite: turns inside those date ranges; full-text (FTS5/BM25) hits on the topic words; recorded facts for the entities mentioned.
3. **Assemble**: stable rules, today's date and timezone, then a "Prior conversations" block with old answers quoted verbatim, each with its date, sources and recorded claims. Every date checked and found empty says so, with the nearest days that do have history, and a final directive says what "nothing found" obliges the model to do.
4. **Model with one tool**, `web_search(query, site?, since?)`: parallel calls, a 5-step cap whose last step has tools disabled, an idle/total watchdog, a per-query-per-day cache.
5. **Stream** with `[n]` citations. 6. **Persist** the turn, sources and a trace (visible at `/debug`). 7. **After the response**, extract `(entity, attribute, value, source, as_of)` facts.

## 2. Why: deterministic before the model, judgment inside it

Dates and memory are things code can get exactly right and test: 76 tests cover DST days, a user in Auckland whose "yesterday" is a different UTC day, and ambiguous weekdays. Running them first costs about 5 ms and no round trip, and makes "no record" a fact in the prompt instead of something the model must remember to say. The model keeps what needs judgment: what to search, how to read a page, how to word the diff.

`site` exists because date filters cannot find pricing pages. Tavily's own docs say continuously updated pages keep their old publish date and are dropped by date filters, so for "has the price changed?" the model reads the vendor's page directly (the body, prices within the first ~2k characters) and uses a dated search only for announcements.

## 3. Considered and rejected

- **Vector DB / embeddings for memory.** These questions are anchored by dates and named entities, where a date filter plus full-text search is exact, faster and explainable. Embeddings would add fuzzy recall ("that thing about databases") and are what I would add next.
- **A planner LLM call before every answer.** Latency on every turn to decide what the resolver already decides.
- **Memory as a second tool.** The brief says one tool, and pre-retrieval saves a round trip.
- **LangChain or another agent framework.** More surface to explain, little gained for one tool.
- **Guessing the ambiguous date.** Checking every plausible reading costs a few SQL queries; picking one wrongly produces a confident "no record".

## 4. Measured

Two suites, live model and web search, throwaway database, one run each on Amazon Nova Pro via Bedrock. **Core: 13/15** (answer starts streaming median 4.1 s, p90 10.4 s; total median 6.7 s, p90 13.1 s). **Held-out: 12/13** (median 6.2 s, p90 9.8 s; total median 7.3 s, p90 11.1 s). The held-out set is 13 new questions of the same kinds as the samples (different tools and weekday, a "two weeks ago" range, Los Angeles across the DST change, an HTML-comment injection). It was written after tuning and not used to tune: it is the check that this is not overfit to three examples. The misses are model discipline (searched a stable-knowledge question, one empty reply, searched when the answer was already in memory), and runs vary by a point or two (the core suite scored 13 to 15 across my runs). Transcripts are in `eval-output/`.

**Model choice, by measurement.** Claude on Bedrock was unavailable to my account (it needs a Marketplace payment method), so I compared the tool-calling models that were. gpt-oss-120b scored 10/15 on core: it searched one query per step, skipped `[n]` citations and once ended on a non-answer. Nova Pro is what the numbers use.

The latency came from measurement, not guesswork. An earlier Nova run was 14/15 with median total 7.4 s and the five-CRM case at 21.4 s. Clipping vendor pages (five vendors had put ~40k characters in front of the model), answering "what did I say?" from memory without searching, and asking for short replies took a later run to 15/15 and a 4.0 s median. The two-suite run above is the final code and a fresh sample, which is why I report it rather than the best one.

What running it changed in the design: a weaker model, told "no conversations stored", still **invented a whole "Then" column** from search results, so the block now ends with an explicit directive (fixed, tested). Topic matching discarded "versions" vs "version" (now scored by the FTS index itself). Models wrote `site:` operators inside the query, which Tavily ignores (now lifted into the parameter). `max_age_hours`, added from the docs for fresher pages, measurably returned *worse* pages and was removed. A poisoned page made the provider's own filter block the reply, so instruction-like sentences are now stripped from page text before the model sees them. Models leaked `<thinking>` blocks and full-width citation brackets (both normalised). And on Bedrock, disabling tools on the last step silently drops all tool results: a model that searched one query per step answered "no searches were available" with four results in hand. The last step is now answered from a plain-text digest, on every provider.

Not measured: other providers, and answer quality beyond the loose checks. Re-run with any key: `npm run eval -- --suite=all --model=anthropic:claude-sonnet-5-5`.

## 5. Another week

Embeddings for vague recall; scheduled re-checks that notify when a tracked price changes; a per-claim verification pass before answering; a retry when a model returns an empty reply; conversation summaries for long histories; per-provider latency tuning (reasoning budgets, streaming a first sentence before the search round; Gemini's default thinking took 20-40 s to first token); real accounts instead of an anonymous cookie.

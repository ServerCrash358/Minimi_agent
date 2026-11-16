# Design

**The insight.** All three sample questions are about *memory over time*, not search. Each needs four steps a plain "LLM + search tool" gets wrong: (1) resolve the date ("Monday", "last Tuesday", "3 November") in the user's timezone; (2) recall exactly what was said then, not a fuzzy summary; (3) re-check it against the live web, including pricing pages that change without an announcement; (4) answer as a diff, and say plainly when there is no record.

## 1. How it works

One function, `runTurn()` ([lib/agent/run.ts](lib/agent/run.ts)), shared by the API route, the evals and the tests:

1. **Resolve dates** with chrono-node plus calendar rules, in the user's timezone, no model call. Ambiguity is kept: "Monday" yields this week's and last week's, `3/11` both readings.
2. **Retrieve** from SQLite: turns in those date ranges, full-text hits on the topic words, recorded facts for the entities.
3. **Decide in code** the kind of turn ([intent.ts](lib/agent/intent.ts)): *recall* ("what did I ask?", search off), *re-check* ("has it changed?"), *conceptual* (search off) or *open* (the model decides). Doubt resolves to open.
4. **Re-check before the model runs** ([prefetch.ts](lib/agent/prefetch.ts)): each recalled fact stores the URL it came from, so the pipeline fetches those vendor pages in parallel plus one dated news search, and checks each earlier value against today's page by string search ([evidence.ts](lib/agent/evidence.ts)). The model then usually answers in one step. Still one tool: the pipeline calls `web_search` early, through the executor the model uses.
5. **Model**, with the memory block (old answers verbatim with date, sources and claims; every empty date stated; a closing directive for "nothing found"), a 5-step cap, and a watchdog.
6. **Check the answer** ([guard.ts](lib/agent/guard.ts)): empty, a one-line non-answer, no `[n]` citations, no "As of" date, a list where a table belongs. One rewrite if a rule fails, never a loop.
7. **Stream and persist** the turn and a trace (visible at `/debug`); afterwards, extract `(entity, attribute, value, source, as_of)` facts.

## 2. Why: deterministic before the model, judgment inside it

Dates and memory are things code gets exactly right and can test: 108 tests cover DST days, a user in Auckland whose "yesterday" is a different UTC day, and ambiguous weekdays. It costs about 5 ms and no round trip, and makes "no record" a fact in the prompt rather than something the model must remember to say.

The principle was extended after measuring failures. Every miss in the eval history was a *decision* the model made badly: searching when the answer was already in memory, searching a conceptual question, stopping at a one-line non-answer, glossing a price comparison. So what a rule can decide, a rule decides (whether to search, which pages to re-fetch, whether an old value is still on the page), and the model keeps what needs judgment: reading a page and wording the diff. `site` exists because date filters cannot find pricing pages: Tavily's docs say continuously updated pages keep their old publish date and are dropped by date filters.

## 3. Considered and rejected

- **Vector DB / embeddings.** The questions are anchored by dates and named entities, where a date filter plus full-text search is exact, faster and explainable. Embeddings are what I would add next, for vague recall.
- **A planner LLM call before every answer.** Latency on every turn to decide what the resolver and intent rules already decide.
- **A second LLM to judge answers.** More latency and cost, and wrong in the same ways. Form is checked by code; correctness by an eval with canned pages of known truth.
- **Memory as a second tool**, since the brief says one tool and pre-retrieval saves a round trip. **LangChain or similar**, for one tool.
- **Guessing the ambiguous date.** Checking every reading costs a few SQL queries; guessing wrong yields a confident "no record".

## 4. Measured

Three suites on Amazon Nova Pro (Bedrock); the final code was run twice in a row and **both runs passed 33/33**. **Core 15/15** (live web; answer starts streaming median 5.8 s, p90 10.0 s; total median 6.7 s, p90 12.7 s). **Held-out 13/13**: new questions of the same kinds as the samples, written after tuning and not used to tune, so it checks the agent is not overfit to three examples (median 3.3 s, p90 10.8 s; total 4.1 s, 12.6 s). **Accuracy 5/5**: canned vendor pages with known prices, where every Changed / Unchanged / Could-not-verify verdict must be right, including a page that fails to load; no search credits. Transcripts are in `eval-output/`.

The trajectory matters more than the final number. Before these changes the suites scored 13/15 and 12/13, and the first run after them 30/33. That run showed three things, each fixed at its cause: the harness let one case's question become the next case's "history"; a verdict check missed plainly correct wording; and the model wrote "Now: $19, Unchanged" for a page saying "$0 monthly minimum", hence the code-side check of earlier values (only *absence* is reported: "Python 3.14" is still on the page as the previous release). Live runs vary, so two clean runs are evidence, not a guarantee. Claude on Bedrock was unavailable to my account, so I compared the tool-calling models that were: gpt-oss-120b scored 10/15 (serial searches, skipped citations, one non-answer), so Nova Pro is what the numbers use.

Earlier evals also changed the design: a weaker model invented a whole "Then" column when told "nothing stored" (now a closing directive); topic matching missed "versions" vs "version" (now scored by the FTS index); models wrote `site:` inside queries, which Tavily ignores (now lifted into the parameter); `max_age_hours` measurably returned *worse* pages and was removed; a poisoned page tripped the provider's filter (instruction-like sentences are now stripped); and Bedrock silently drops tool results when tools are off on the last step (now answered from a plain-text digest on every provider).

## 5. Another week

Embeddings for vague recall; scheduled re-checks that notify when a tracked price changes; a cap on extra model steps after a successful prefetch to trim the p90; per-provider latency tuning (Gemini's default thinking took 20-40 s to first token); conversation summaries for long histories; real accounts instead of an anonymous cookie.

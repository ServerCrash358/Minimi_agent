# Minimi chat agent

**A chat agent with live web search that remembers what you asked, and can tell you what has changed since.**

Most "chat with search" demos answer the question in front of them. The questions people actually bring back are about *time*:
*"On Monday we shortlisted 5 CRM tools. Has any of them changed pricing since?"* or *"What did I ask you on 3 November? Is your answer still correct today?"*
This agent resolves the date, recalls exactly what it said then, re-checks that against the live web, and answers as a diff.

> **You:** Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?
>
> ↺ *Recalled your chat from Tue 10 Nov · re-checked 3 vendor pages*
>
> **Agent:** As of 16 November 2026, here are the changes in pricing since 10 November 2026:
>
> | Item | Then (10 Nov 2026) | Now | Verdict | Source |
> | --- | --- | --- | --- | --- |
> | Neon Launch plan price per month | $19 | Usage-based, $0 monthly minimum | Changed | [1] |
> | Supabase Pro plan price per month | $25 | $25 | Unchanged | [2] |
> | AWS RDS db.t4g.micro approximate price per month | about $12 plus storage | about $12 plus storage | Unchanged | [3] |
>
> *(Abridged from the accuracy eval, which uses canned vendor pages, so the "Now" prices are fixtures, not today's real prices. The "Then" column is quoted from the stored conversation, not reconstructed. With no stored conversation, the agent says it has no record and offers to check the items you name.)*

## What it does

- **Resolves dates the way people mean them.** "Monday", "last Tuesday", "3 November", "two weeks ago", "last week", `3/11`: computed in the user's own timezone, with every plausible reading kept (this Monday or last, day-first or month-first) rather than guessed.
- **Recalls the exact earlier answer.** Past turns come back verbatim with their date, sources and the claims they made, across chats, by date, by topic, or both. A chip above each answer shows what was remembered.
- **Re-checks the live web where change actually happens.** It reads the vendor's own pricing page, because pricing pages are edited in place and date-filtered search silently misses them, and uses dated search for announcements.
- **Checks its own diff.** Each earlier value is looked up, by code, on the page fetched today. A price that has vanished from the vendor's page is flagged to the model, and a page that failed to load is reported as "could not verify", never as "unchanged".
- **Never invents a past.** If nothing was stored, it says so, names the dates it looked at, and mentions the nearest conversations.
- **Fast and visible.** Answers stream with `[n]` citations, searches run in parallel with live "Searching: …" status, and a debug page shows what the agent did on every turn.

## Run it

Needs Node 20+. No Docker, no external database (a SQLite file in `./data`).

```bash
npm install
cp .env.example .env.local   # add a model key and a Tavily key
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `TAVILY_API_KEY` | Web search. The free tier (1,000 credits a month, no card) is plenty: [tavily.com](https://tavily.com). |
| `MODEL` | `provider:model-id`, for example `anthropic:claude-sonnet-5-5`, `openai:gpt-5`, `google:gemini-3-flash-preview`, `bedrock:us.amazon.nova-pro-v1:0`. Swapping provider is an env change, no code. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | The key for the provider in `MODEL`. |
| `AWS_BEARER_TOKEN_BEDROCK` (or `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`), `AWS_REGION` | Only for `bedrock:` models. |
| `EXTRACT_MODEL` | Optional small model for background fact extraction (defaults to the same provider's small model). |

A missing or wrong credential produces a readable error in the chat that names what to fix.

## Try the memory features in 30 seconds

1. Open **Debug** (bottom of the sidebar) and press **Load demo history**. It adds three backdated conversations to your own memory, dated relative to today: a CRM shortlist on the most recent Monday, a Python-version question on 3 November, and a Postgres-hosting comparison last Tuesday.
2. Start a new chat and ask:
   - *On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?*
   - *What did I ask you on 3 November? Is your answer still correct today?*
   - *Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?*
3. On a fresh install with no history, the same questions get an honest "I have no record of that" instead.
4. **Pretend today is…** on the Debug page moves the app's clock, so you can ask a real question now, jump a week ahead, and ask about "last Tuesday".
5. Open any turn on the Debug page to see the dates it resolved, the memory it retrieved (and the exact block the model saw), what the pipeline decided in code, the searches (and who started each), the answer check, and where the time went.

## How it works

```
message ─► 1 resolve dates ─► 2 retrieve memory ─► 3 decide in code ─► 4 re-check searches ─► 5 model ─► 6 check the answer ─► 7 stream + persist
           (user timezone)     (SQLite: date,        recall? recheck?    (vendor pages from      (one step     (citations, date,       └─► extract facts
                                full-text, facts)     conceptual? open?   the old answer,         when the      table; one repair
                                                                          started before the      searches      if it breaks a rule)
                                                                          model runs)             are done)
```

Steps 1 to 4 are deterministic code (the memory steps take about 5 ms and no model call), so dates, recall and the decision to search are exact and testable. A question that asks *what was said* is answered from memory with search switched off, a general-knowledge question is answered directly, and a "has it changed?" question has its vendor pages fetched in parallel before the model starts, so it can usually answer in one step. The model handles what needs judgment: reading the pages and wording the diff. The reasoning, and what was considered and rejected, is in **[DESIGN.md](DESIGN.md)**.

## Results

Three eval suites, all on **Amazon Nova Pro** (Bedrock). The final code was run **twice in a row: both runs passed 33 of 33**. The numbers below are from the second.

| Suite | What it checks | Passed | Answer starts streaming | Total time |
| --- | --- | --- | --- | --- |
| **Core** | the three sample questions and the cases written alongside them, live web | **15 of 15** | median 5.8 s, p90 10.0 s | median 6.7 s, p90 12.7 s |
| **Held-out** | 13 *new* questions of the same kinds, different tools, days and wording, live web | **13 of 13** | median 3.3 s, p90 10.8 s | median 4.1 s, p90 12.6 s |
| **Accuracy** | canned vendor pages with known prices: is every Changed / Unchanged / Could-not-verify verdict *right*? | **5 of 5** | median 3.4 s, p90 6.5 s | median 5.8 s, p90 9.6 s |

The **held-out** suite checks that the behaviour generalises beyond the examples it was built around. It was written after the pipeline was tuned and was not used to tune it. Each question has a counterpart in the core suite:

| Core | Held-out counterpart |
| --- | --- |
| "On Monday we shortlisted 5 CRM tools…" | "On Thursday we shortlisted 4 helpdesk tools for a 12-person support team…" |
| "What did I ask you on 3 November? Is your answer still correct?" | "What did I ask you on 5 November? Is that still accurate?" (a software version, not a price) |
| "Last Tuesday I asked you about Postgres hosting…" | "Two weeks ago I asked you about vector database hosting…" (a date *range*, not a day) |
| Timezone: Auckland | Timezone: Los Angeles, across the daylight-saving change |
| Prompt injection as a sentence in a page | Prompt injection hidden in an HTML comment |

The **accuracy** suite is the one that proves the answers are *correct*, not just well-formed. Each case changes some prices and leaves others alone, and one vendor's page fails to load, so a model that says "changed" for everything, "unchanged" for everything, or hides a failure, fails. It costs no search credits, because the pages are canned.

<details>
<summary>Core suite, every case</summary>

| Case | Answer starts | Total | Searches |
| --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | 7.2 s | 16.5 s | 7 |
| Sample 2: what did I ask on 3 November, is it still correct | 2.5 s | 6.7 s | 2 |
| Sample 3: Postgres hosting asked last Tuesday | 10.6 s | 12.7 s | 7 |
| A date with no conversation, for a user who has history | 1.4 s | 2.4 s | 0 |
| A question that needs no search | 0.9 s | 2.1 s | 0 |
| Multi-entity comparison | 10.0 s | 11.5 s | 3 |
| Ambiguous "last week" | 2.0 s | 3.6 s | 0 |
| Recall across threads, no date given | 2.9 s | 3.5 s | 0 |
| Right topic, wrong day | 2.2 s | 3.0 s | 0 |
| Timezone: the user's "yesterday", not the server's | 2.4 s | 3.0 s | 0 |
| Prompt injection inside a search result | 6.1 s | 6.8 s | 1 |
| Search tool times out | 5.8 s | 6.5 s | 1 |
| Current fact with a source | 9.9 s | 10.5 s | 1 |
| Pricing question goes to the vendor's page | 8.5 s | 9.6 s | 1 |
| Sample 3 from a brand-new user | 6.4 s | 10.2 s | 1 |

</details>

<details>
<summary>Held-out suite, every case</summary>

| Case | Answer starts | Total | Searches |
| --- | --- | --- | --- |
| Shortlist recalled by weekday: four helpdesk tools | 11.7 s | 14.2 s | 10 |
| Explicit date, still accurate? | 6.6 s | 8.5 s | 3 |
| "Two weeks ago": vector database hosting | 10.8 s | 12.6 s | 7 |
| Right topic, wrong day (helpdesk) | 2.3 s | 3.9 s | 0 |
| A date with no conversation | 2.7 s | 3.9 s | 0 |
| Brand-new user asks about a past chat | 3.1 s | 3.9 s | 0 |
| Three-way comparison: Notion, Coda, Airtable | 8.5 s | 10.2 s | 3 |
| A question that needs no search | 1.7 s | 2.8 s | 0 |
| Current fact: latest stable Go | 9.8 s | 10.3 s | 1 |
| Pricing question goes to the vendor's page | 9.4 s | 10.0 s | 2 |
| Timezone: Los Angeles, across the DST change | 3.3 s | 4.1 s | 0 |
| Prompt injection hidden in an HTML comment | 3.0 s | 3.6 s | 1 |
| Search outage on a price question | 2.4 s | 3.2 s | 1 |

</details>

<details>
<summary>Accuracy suite, every case</summary>

| Case | Answer starts | Total | Searches |
| --- | --- | --- | --- |
| Postgres: Neon changed, Supabase and RDS did not | 2.9 s | 5.6 s | 5 |
| CRM: HubSpot changed, three unchanged, one page failed to load | 3.4 s | 6.2 s | 9 |
| Python: the latest stable version has moved on | 2.6 s | 5.8 s | 4 |
| Helpdesk: Intercom changed, the other three did not | 6.5 s | 9.6 s | 7 |
| Vector databases: Qdrant's free tier changed, the others did not | 3.6 s | 5.8 s | 8 |

</details>

**How to read these numbers.** Before this round of changes the same core and held-out suites scored 13 of 15 and 12 of 13, and the first full run after them scored 30 of 33. That run exposed problems that were fixed rather than excused: eval cases were leaking into each other's history, one verdict check was too narrow, and the model once wrote "Now: $19, Unchanged" for a page that said "$0 monthly minimum", which is what the code-side check of earlier values now catches. Live model runs vary, so treat two clean runs as evidence, not a guarantee. After the first run, live search results are served from a same-day cache, so a cold run adds Tavily's one to four seconds per search round. "First token" is any text at all; "answer starts" is when the answer itself begins streaming, after any searches, which is what a reader waits for.

**Model choice.** The pipeline is model-agnostic. On the AWS account used for these runs, Claude on Bedrock was unavailable (it needs a Marketplace payment method), so I compared the tool-calling models that were: Amazon Nova Pro, and OpenAI's open-weight gpt-oss-120b. gpt-oss-120b scored 10 of 15 on the core suite before these changes (it searched one query at a time, skipped `[n]` citations, and once ended on a non-answer), so Nova Pro is what the numbers use. Run it with any provider: `npm run eval -- --suite=all --model=anthropic:claude-sonnet-5-5` (about 50 search credits cold, almost none warm). Full transcripts, including the memory block the model saw and every search, are in [eval-output/core](eval-output/core/transcripts), [eval-output/holdout](eval-output/holdout/transcripts) and [eval-output/accuracy](eval-output/accuracy/transcripts).

## Engineering notes

- **108 tests, no network or keys needed.** Models and search are scripted, so the suite covers the date resolver (DST days, a user in Auckland whose "yesterday" is a different UTC day, ambiguous weekdays), retrieval, the whole pipeline, the answer check and its repair, error handling, and the eval harness itself, including cases that must fail.
- **Decisions the model used to make are made in code.** Whether to search (recall, conceptual and re-check turns), which vendor pages to re-fetch, and whether an earlier value is still on the page are rules with tests, because each one was a place a live model went wrong.
- **Answers are checked, and repaired once if needed.** An empty reply, a one-line non-answer, missing `[n]` citations, a missing "As of" date, or a list where a table belongs triggers exactly one rewrite. It never loops.
- **Untrusted web content is treated as data.** Sentences addressed to an AI are stripped from search results before the model sees them, with narrow patterns that leave ordinary pages untouched.
- **Always ends in an answer or a readable error.** A 5-step cap whose last step is answered from a plain-text digest of the results (some providers drop tool content when tools are off), an idle and total watchdog, per-search timeouts that are reported rather than hidden, and provider errors translated into what to do about them.
- **Fast by construction.** Searches run in parallel, vendor pages are clipped to the parts that hold prices, an identical search made twice in one turn runs once, results are cached per query per day (never across a day boundary, when a price may have changed), and fact extraction runs after the response is sent.
- **Works across models.** Reasoning tags and full-width citation brackets some models emit are normalised before display and storage.
- **Every turn is explainable.** Traces are stored for successful and failed turns alike and rendered on `/debug`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm test` | The 108 tests. |
| `npm run eval` | The core eval. Options: `-- --suite=core\|holdout\|accuracy\|all`, `-- --only=id1,id2` (writes to `eval-output/partial`, never over a full report), `-- --model=provider:id`, `-- --no-cache`, `-- --list`. |
| `npm run seed [-- <user-id>]` | The demo history from the command line. |

## Layout

```
app/                     Next.js App Router: chat UI, /debug, API routes
lib/agent/run.ts         runTurn(): the whole pipeline, shared by the route, the evals and the tests
lib/agent/intent.ts      decides in code: recall, re-check, conceptual or open
lib/agent/prefetch.ts    plans the re-check searches from the recalled facts' own source pages
lib/agent/evidence.ts    checks each earlier value against today's pages
lib/agent/guard.ts       checks the answer's form, repairs it once if needed
lib/agent/tool.ts        the one tool, web_search
lib/agent/prompt.ts      system prompt
lib/agent/model.ts       "provider:model" -> model
lib/temporal/resolve.ts  "Monday", "last Tuesday", "3 November" -> exact day ranges
lib/memory/              retrieval (date, full-text, facts), context block, fact extraction, memory chip
lib/search/              Tavily client and per-day cache
lib/db/                  SQLite schema and queries
lib/eval/                the core, held-out and accuracy suites, and the runner
tests/                   node:test suites
```

## Scope

Identity is an anonymous cookie, so memory spans chats on one browser, with no accounts. The demo clock and demo-history loader are global to an instance, which suits a single-tenant demo.

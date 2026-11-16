# Minimi chat agent

**A chat agent with live web search that remembers what you asked, and can tell you what has changed since.**

Most "chat with search" demos answer the question in front of them. The questions people actually bring back are about *time*:
*"On Monday we shortlisted 5 CRM tools. Has any of them changed pricing since?"* or *"What did I ask you on 3 November? Is your answer still correct today?"*
This agent resolves the date, recalls exactly what it said then, re-checks that against the live web, and answers as a diff.

> **You:** Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?
>
> **Agent:** As of 16 November 2026, here are the changes in pricing since 10 November 2026:
>
> | Item | Then (10 Nov 2026) | Now | Verdict | Source |
> | --- | --- | --- | --- | --- |
> | Neon Launch plan price per month | $19 | Usage-based, typical spend $15/mo | Changed | [9] |
> | Supabase Pro plan price per month | $25 | $25 | Unchanged | [5] |
> | AWS RDS db.t4g.micro approximate price per month | about $12 plus storage | about $12 plus storage | Unchanged | [1] |
>
> *(A real answer from an eval run, abridged. The "Then" column is quoted from the stored conversation, not reconstructed. With no stored conversation, the agent says it has no record and offers to check the items you name.)*

## What it does

- **Resolves dates the way people mean them.** "Monday", "last Tuesday", "3 November", "two weeks ago", "last week", `3/11`: computed in the user's own timezone, with every plausible reading kept (this Monday or last, day-first or month-first) rather than guessed.
- **Recalls the exact earlier answer.** Past turns come back verbatim with their date, sources and the claims they made, across chats, by date, by topic, or both.
- **Re-checks the live web where change actually happens.** It reads the vendor's own pricing page, because pricing pages are edited in place and date-filtered search silently misses them, and uses dated search for announcements.
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
5. Open any turn on the Debug page to see the dates it resolved, the memory it retrieved (and the exact block the model saw), the searches it chose, and where the time went.

## How it works

```
message ─► 1 resolve dates ─► 2 retrieve memory ─► 3 assemble context ─► 4 model + web_search ─► 5 stream
           (user timezone)     (SQLite: date,        (rules, today,         (parallel searches,     with citations
                                full-text, facts)     "Prior conversations") 5-step cap)
                                                                                       └─► 6 persist turn + trace ─► 7 extract facts
```

Steps 1 to 3 are deterministic code (about 5 ms, no model call), so dates and recall are exact and testable. The model handles what needs judgment: what to search and how to word the diff. The reasoning, and what was considered and rejected, is in **[DESIGN.md](DESIGN.md)**.

## Results

Two eval suites run against the live model and live web search, each on a throwaway database. Both were run once on **Amazon Nova Pro** (Bedrock) with the final code.

| Suite | Passed | Answer starts streaming | Total time |
| --- | --- | --- | --- |
| **Core**: the three sample questions plus the cases written alongside them | **13 of 15** | median 4.1 s, p90 10.4 s | median 6.7 s, p90 13.1 s |
| **Held-out**: 13 *new* questions of the same kinds, different tools, days and wording | **12 of 13** | median 6.2 s, p90 9.8 s | median 7.3 s, p90 11.1 s |

The held-out suite exists to check that the behaviour generalises beyond the examples it was built around. It was written after the pipeline and prompt were tuned, and neither was changed to suit it. Each question has a counterpart in the core suite:

| Core | Held-out counterpart |
| --- | --- |
| "On Monday we shortlisted 5 CRM tools…" | "On Thursday we shortlisted 4 helpdesk tools for a 12-person support team…" |
| "What did I ask you on 3 November? Is your answer still correct?" | "What did I ask you on 5 November? Is that still accurate?" (a software version, not a price) |
| "Last Tuesday I asked you about Postgres hosting…" | "Two weeks ago I asked you about vector database hosting…" (a date *range*, not a day) |
| Timezone: Auckland | Timezone: Los Angeles, across the daylight-saving change |
| Prompt injection as a sentence in a page | Prompt injection hidden in an HTML comment |

<details>
<summary>Held-out suite, every case</summary>

| Case | Result | Answer starts | Total | Searches |
| --- | --- | --- | --- | --- |
| Shortlist recalled by weekday: four helpdesk tools | pass | 14.3 s | 18.0 s | 8 |
| Explicit date, still accurate? | pass | 8.2 s | 9.8 s | 1 |
| "Two weeks ago": vector database hosting | pass | 8.7 s | 9.9 s | 3 |
| Right topic, wrong day (helpdesk) | **fail** | 6.2 s | 9.0 s | 1 |
| A date with no conversation | pass | 1.4 s | 1.9 s | 0 |
| Brand-new user asks about a past chat | pass | 0.8 s | 1.8 s | 0 |
| Three-way comparison: Notion, Coda, Airtable | pass | 5.0 s | 6.5 s | 3 |
| A question that needs no search | pass | 3.3 s | 6.4 s | 0 |
| Current fact: latest stable Go | pass | 6.9 s | 7.5 s | 1 |
| Pricing question goes to the vendor's page | pass | 9.8 s | 11.1 s | 2 |
| Timezone: Los Angeles, across the DST change | pass | 2.4 s | 3.0 s | 0 |
| Prompt injection hidden in an HTML comment | pass | 4.4 s | 4.7 s | 1 |
| Search outage on a price question | pass | 7.0 s | 7.3 s | 1 |

</details>

<details>
<summary>Core suite, every case</summary>

| Case | Result | Answer starts | Total | Searches |
| --- | --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | pass | 13.6 s | 15.9 s | 6 |
| Sample 2: what did I ask on 3 November, is it still correct | pass | 6.1 s | 8.7 s | 2 |
| Sample 3: Postgres hosting asked last Tuesday | pass | 5.2 s | 7.3 s | 3 |
| A date with no conversation, for a user who has history | pass | 0.9 s | 1.6 s | 0 |
| A question that needs no search | **fail** | 4.1 s | 6.7 s | 1 |
| Multi-entity comparison | pass | 10.4 s | 13.0 s | 3 |
| Ambiguous "last week" | **fail** | n/a | n/a | 0 |
| Recall across threads, no date given | pass | 10.3 s | 11.7 s | 2 |
| Right topic, wrong day | pass | 3.3 s | 7.3 s | 0 |
| Timezone: the user's "yesterday", not the server's | pass | 3.2 s | 3.6 s | 0 |
| Prompt injection inside a search result | pass | 2.2 s | 3.0 s | 1 |
| Search tool times out | pass | 2.5 s | 3.3 s | 1 |
| Current fact with a source | pass | 4.9 s | 5.2 s | 1 |
| Pricing question goes to the vendor's page | pass | 3.0 s | 4.2 s | 1 |
| Sample 3 from a brand-new user | pass | 7.9 s | 13.1 s | 1 |

</details>

**The three misses** are model discipline, not the pipeline: the model ran a search for a stable-knowledge question, returned an empty reply once, and ran a search when the answer was already in memory. Runs on the same model vary by a point or two (across all my runs of the core suite on this model it scored between 13 and 15 of 15), so read these as a range, not a promise. "First token" is any text at all; "answer starts" is when the answer itself begins streaming, after any searches, which is what a reader waits for. Questions needing no search start answering in about a second.

**Model choice.** The pipeline is model-agnostic. On the AWS account used for these runs, Claude on Bedrock was unavailable (it needs a Marketplace payment method), so I compared the tool-calling models that were: Amazon Nova Pro, and OpenAI's open-weight gpt-oss-120b. gpt-oss-120b scored 10 of 15 on the core suite: it searched one query at a time, often skipped `[n]` citations, and once ended on a non-answer, so Nova Pro is what the numbers above use. Run it yourself with any provider: `npm run eval -- --suite=all --model=anthropic:claude-sonnet-5-5` (about 50 search credits and 80 model calls). Full transcripts, including the memory block the model saw and every search, are in [eval-output/core/transcripts](eval-output/core/transcripts) and [eval-output/holdout/transcripts](eval-output/holdout/transcripts).

## Engineering notes

- **76 tests, no network or keys needed.** Models and search are scripted, so the suite covers the date resolver (DST days, a user in Auckland whose "yesterday" is a different UTC day, ambiguous weekdays), retrieval, the whole pipeline, error handling and the eval harness itself, including cases that must fail.
- **Untrusted web content is treated as data.** Sentences addressed to an AI are stripped from search results before the model sees them, with narrow patterns that leave ordinary pages untouched.
- **Always ends in an answer or a readable error.** A 5-step cap whose last step is answered from a plain-text digest of the results (some providers drop tool content when tools are off), an idle and total watchdog, per-search timeouts that are reported rather than hidden, and provider errors translated into what to do about them.
- **Fast by construction.** Searches run in parallel in one step, vendor pages are clipped to the parts that hold prices, results are cached per query per day (never across a day boundary, when a price may have changed), and fact extraction runs after the response is sent.
- **Works across models.** Reasoning tags and full-width citation brackets some models emit are normalised before display and storage.
- **Every turn is explainable.** Traces are stored for successful and failed turns alike and rendered on `/debug`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm test` | The 76 tests. |
| `npm run eval` | The core eval. Options: `-- --suite=core\|holdout\|all`, `-- --only=id1,id2` (writes to `eval-output/partial`, never over a full report), `-- --model=provider:id`, `-- --list`. |
| `npm run seed [-- <user-id>]` | The demo history from the command line. |

## Layout

```
app/                     Next.js App Router: chat UI, /debug, API routes
lib/agent/run.ts         runTurn(): the whole pipeline, shared by the route, the evals and the tests
lib/agent/tool.ts        the one tool, web_search
lib/agent/prompt.ts      system prompt
lib/agent/model.ts       "provider:model" -> model
lib/temporal/resolve.ts  "Monday", "last Tuesday", "3 November" -> exact day ranges
lib/memory/              retrieval (date, full-text, facts), context block, fact extraction
lib/search/              Tavily client and per-day cache
lib/db/                  SQLite schema and queries
lib/eval/                the core and held-out suites, and the runner
tests/                   node:test suites
```

## Scope

Identity is an anonymous cookie, so memory spans chats on one browser, with no accounts. The demo clock and demo-history loader are global to an instance, which suits a single-tenant demo.

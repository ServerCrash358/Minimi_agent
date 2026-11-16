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
> *(A real answer from the eval run, abridged. The "Then" column is quoted from the stored conversation, not reconstructed. With no stored conversation, the agent says it has no record and offers to check the items you name.)*

## What it does

- **Resolves dates the way people mean them.** "Monday", "last Tuesday", "3 November", "last week", `3/11`: computed in the user's own timezone, with every plausible reading kept (this Monday or last, day-first or month-first) rather than guessed.
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
| `MODEL` | `provider:model-id`: `anthropic:claude-sonnet-5-5`, `openai:gpt-5`, `google:gemini-3-flash-preview` or `bedrock:us.anthropic.claude-sonnet-4-6`. Swapping provider is an env change, no code. |
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

`npm run eval` runs 15 cases against the live model and live web search on a throwaway database: the three sample questions, a date with no history, a question needing no search, a multi-entity comparison, an ambiguous "last week", recall across chats, right topic on the wrong day, a timezone edge, prompt injection, a search outage, a current-fact lookup, a pricing-page lookup, and a brand-new user.

**15 of 15 pass** (Amazon Nova Pro on Bedrock). Time until the answer starts streaming: median 2.7 s, p90 8.7 s. Total time: median 4.0 s, p90 9.9 s, max 10.9 s. 1.3 searches per answer on average.

| Case | First token | Answer starts | Total | Searches |
| --- | --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | 1.9 s | 8.7 s | 10.9 s | 6 |
| Sample 2: what did I ask on 3 November, is it still correct | 2.4 s | 4.5 s | 6.0 s | 2 |
| Sample 3: Postgres hosting asked last Tuesday | 0.8 s | 8.1 s | 9.5 s | 3 |
| A date with no conversation, for a user who has history | 1.5 s | 1.5 s | 2.3 s | 0 |
| A question that needs no search | 1.3 s | 1.3 s | 2.9 s | 0 |
| Multi-entity comparison (Linear, Jira, Asana) | 1.8 s | 8.3 s | 9.5 s | 3 |
| Ambiguous "last week" | 1.7 s | 1.7 s | 3.1 s | 0 |
| Recall across chats, no date given | 0.9 s | 0.9 s | 2.9 s | 0 |
| Right topic, wrong day | 0.9 s | 0.9 s | 4.0 s | 0 |
| Timezone: the user's "yesterday", not the server's | 2.1 s | 2.1 s | 2.4 s | 0 |
| Prompt injection inside a search result | 0.8 s | 2.2 s | 2.6 s | 1 |
| Search tool times out | 0.8 s | 2.7 s | 2.9 s | 1 |
| Current fact with a source | 1.1 s | 6.1 s | 7.4 s | 1 |
| Pricing question goes to the vendor's page | 1.5 s | 8.8 s | 9.9 s | 2 |
| Sample 3 from a brand-new user | 1.3 s | 4.9 s | 5.8 s | 1 |

"First token" is the first text of any kind; "Answer starts" is when the answer itself begins streaming, after any searches, which is what a reader waits for. Questions that need no search start answering in about a second. Full transcripts, including the memory block the model saw and every search, are in [eval-output/latest/transcripts](eval-output/latest/transcripts). Run it yourself with any provider: `npm run eval -- --model=anthropic:claude-sonnet-5-5` (about 35 search credits and 40 model calls). Live runs vary by a point or two between runs, as any model does.

## Engineering notes

- **68 tests, no network or keys needed.** Models and search are scripted, so the suite covers the date resolver (DST days, a user in Auckland whose "yesterday" is a different UTC day, ambiguous weekdays), retrieval, the whole pipeline, error handling and the eval harness itself, including cases that must fail.
- **Untrusted web content is treated as data.** Sentences addressed to an AI are stripped from search results before the model sees them, with narrow patterns that leave ordinary pages untouched.
- **Always ends in an answer or a readable error.** A 5-step cap whose last step has tools disabled, an idle and total watchdog, per-search timeouts that are reported rather than hidden, and provider errors translated into what to do about them.
- **Fast by construction.** Searches run in parallel in one step, vendor pages are clipped to the parts that hold prices, results are cached per query per day (never across a day boundary, when a price may have changed), and fact extraction runs after the response is sent.
- **Every turn is explainable.** Traces are stored for successful and failed turns alike and rendered on `/debug`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm test` | The 68 tests. |
| `npm run eval` | The 15-case eval. Options: `-- --only=id1,id2`, `-- --model=provider:id`, `-- --list`. |
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
lib/eval/                the 15 eval cases and the runner
tests/                   node:test suites
```

## Scope

Identity is an anonymous cookie, so memory spans chats on one browser, with no accounts. The demo clock and demo-history loader are global to an instance, which suits a single-tenant demo.

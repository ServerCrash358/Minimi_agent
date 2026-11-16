# Minimi chat agent

A chat agent with one tool, `web_search`, built around the idea that most useful questions are about **memory over time**:
"On Monday we shortlisted 5 CRM tools. Has any of them changed pricing since?", "What did I ask you on 3 November? Is your answer still correct today?"
It resolves the date, recalls exactly what was said then, re-checks it against the live web, and answers as a diff.

How it works and why it is built this way: [DESIGN.md](DESIGN.md).

## Run it

Needs Node 20+. No Docker, no external database (SQLite file in `./data`).

```bash
npm install
cp .env.example .env.local   # then add a model key and a Tavily key
npm run dev                  # http://localhost:3000
```

Keys (all listed in [.env.example](.env.example)):

| Variable | What for |
| --- | --- |
| `TAVILY_API_KEY` | Web search. Free tier (1,000 credits a month, no card) at [tavily.com](https://tavily.com). |
| `MODEL` | `provider:model-id`, one of `anthropic:claude-sonnet-5-5`, `openai:gpt-5`, `google:gemini-3-flash-preview`, `bedrock:us.anthropic.claude-sonnet-5-5`. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Only the key for the provider in `MODEL`. |
| `AWS_BEARER_TOKEN_BEDROCK` (or `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`), `AWS_REGION` | Only for `bedrock:` models. |
| `EXTRACT_MODEL` | Optional small model for the background fact-extraction job. Defaults to the same provider's small model. |

If `MODEL` is unset, the first provider with credentials is used. A missing or wrong key shows a readable error in the chat that names the variable.

## Try the memory features without waiting a week

1. Open **Debug** (bottom of the sidebar, or `/debug`) and press **Load demo history**. That adds three backdated conversations to your own memory, dated relative to today: a CRM shortlist on the most recent Monday, a Python-version question on 3 November, and a Postgres-hosting comparison last Tuesday. (The prices in them are deliberately a little out of date, so there is something to re-check.)
2. Start a new chat and ask any of:
   - *On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?*
   - *What did I ask you on 3 November? Is your answer still correct today?*
   - *Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?*
3. On a fresh install with no history, the same questions get an honest "I have no record of that" naming the dates it checked, and an offer to do the check if you say what was discussed.
4. **Pretend today is…** on the same page moves the app's clock forward, so you can ask a real question now, jump a week ahead, and ask about "last Tuesday".
5. Every turn is traceable on the Debug page: dates resolved, memory retrieved (and the exact block the model saw), searches chosen, and where the time went.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm test` | 62 unit and pipeline tests. No network, no keys needed (models and search are scripted). |
| `npm run eval` | 15-question eval against the live model and live web, on a throwaway database. Writes `eval-output/latest/`. `-- --only=id1,id2`, `-- --model=provider:id`, `-- --list`. |
| `npm run seed [-- <user-id>]` | Same demo history as the Debug button, from the command line. |

## Eval results

Latest full run (`npm run eval`, 15 cases, live web search, throwaway database). Full transcripts, including the memory block the model saw and every search, are in [eval-output/latest/transcripts](eval-output/latest/transcripts).

**Model: Amazon Nova Pro via Bedrock. 14 of 15 pass.** Time to first token: median 1.3 s, p90 1.9 s. Total time: median 7.4 s, p90 13.1 s, max 21.4 s (the five-CRM question: 10 searches in one parallel step). 1.7 searches per answer on average.

I ran this on Nova Pro because it was the only strong model my AWS account could use: Claude on Bedrock was blocked by an AWS Marketplace payment-method requirement. Treat it as a floor and re-run with your own key to compare, e.g. `npm run eval -- --model=anthropic:claude-sonnet-5-5`. A run costs roughly 35 search credits and about 40 model calls.

| Case | Result | First token | Total | Searches |
| --- | --- | --- | --- | --- |
| Sample 1: five CRM tools shortlisted on Monday | pass | 1.9 s | 21.4 s | 10 |
| Sample 2: what did I ask on 3 November, is it still correct | pass | 1.3 s | 9.2 s | 2 |
| Sample 3: Postgres hosting asked last Tuesday | pass | 1.5 s | 11.1 s | 3 |
| A date with no conversation, for a user who has history | pass | 0.9 s | 2.4 s | 0 |
| A question that needs no search | pass | 0.8 s | 2.7 s | 0 |
| Multi-entity comparison | pass | 0.8 s | 11.2 s | 3 |
| Ambiguous "last week" | pass | 1.6 s | 4.4 s | 0 |
| Recall across threads, no date given | pass | 1.3 s | 2.5 s | 0 |
| Right topic, wrong day | pass | 1.0 s | 10.9 s | 1 |
| Timezone: the user's "yesterday", not the server's | pass | 1.7 s | 2.1 s | 0 |
| Prompt injection inside a search result | **fail** | 1.3 s | 3.4 s | 1 |
| Search tool times out | pass | 1.4 s | 4.6 s | 1 |
| Current fact with a source | pass | 2.0 s | 11.7 s | 1 |
| Pricing question goes to the vendor's page | pass | 1.3 s | 7.4 s | 2 |
| Sample 3 from a brand-new user | pass | 1.3 s | 13.1 s | 1 |

The one failure, honestly: the injection case. Bedrock's content filter blocked Nova's reply to the poisoned page, so the injected instruction was not obeyed but there was no useful answer either. That is the provider's guardrail, not the pipeline. Across the runs I made, the citation and "as of" checks flip occasionally on this model (they failed in one run and passed in the next on identical code), so expect a point or two of variance between runs.

## Layout

```
app/                     Next.js App Router: chat UI, /debug, API routes (chat, threads, debug)
lib/agent/run.ts         runTurn(): the whole pipeline. Used by the route, the evals and the tests.
lib/agent/tool.ts        the one tool, web_search
lib/agent/prompt.ts      system prompt
lib/agent/model.ts       "provider:model" -> AI SDK model
lib/temporal/resolve.ts  "Monday", "last Tuesday", "3 November" -> exact day ranges in the user's timezone
lib/memory/retrieve.ts   date-range + full-text + entity-fact retrieval from SQLite
lib/memory/context.ts    renders the "Prior conversations" block
lib/memory/facts.ts      background extraction of (entity, attribute, value, source, as_of)
lib/search/              Tavily client and per-day cache
lib/db/                  SQLite schema and queries
lib/eval/                the 15 eval cases and the runner
tests/                   node:test suites
```

## Notes and limits

- Identity is an anonymous cookie. Memory spans chats for the same browser, not across devices. There are no accounts.
- The demo clock ("Pretend today is…") and the demo-history loader are global to the instance, which is fine for a single-tenant demo and would be removed in a product.
- Search results are cached per query per day, so repeated questions cost no extra searches, but a price can never be served stale across a day boundary.

# Postgres: Neon changed, Supabase and RDS did not

**Result:** PASS  
**Why this case exists:** The diff must name the one price that moved and leave the others alone.

## Question

Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?

## Checks

- [x] produced an answer
- [x] recalled the "postgres" conversation (Tue 10 Nov 2026)
- [x] Neon: changed
- [x] Supabase: unchanged
- [x] RDS: unchanged

## Timing

First token 0.9 s, answer starts 2.9 s, total 5.6 s, 2 model step(s).

## Searches

- `Neon pricing plans` (site neon.tech): 1 results, 0 ms
- `Supabase pricing plans` (site supabase.com): 1 results, 0 ms
- `AWS RDS for PostgreSQL pricing plans` (site aws.amazon.com): 1 results, 0 ms
- `Neon, Supabase, AWS RDS for PostgreSQL pricing changes and new announcements` (since 2026-11-10): 1 results, 0 ms
- `Neon, Supabase, AWS RDS for PostgreSQL pricing changes and new announcements` (since 2026-11-10): 1 results, 0 ms

## Answer

As of 16 November 2026, here is the comparison of Postgres hosting pricing since last Tuesday:

| Item | Then (10 Nov 2026) | Now (16 Nov 2026) | Verdict | Source |
| --- | --- | --- | --- | --- |
| Neon Launch plan price per month | $19 | Usage-based with a $0 monthly minimum | Changed | [1] |
| Supabase Pro plan price per month | $25 | $25 | Unchanged | [2] |
| AWS RDS db.t4g.micro approximate price per month | about $12 plus storage | about $12 plus storage | Unchanged | [3] |

Summary: Neon's Launch plan pricing has changed to usage-based with a $0 monthly minimum. Supabase and AWS RDS pricing remain unchanged. 

[1] Neon pricing - https://neon.tech/pricing
[2] Supabase pricing - https://supabase.com/pricing
[3] Amazon RDS for PostgreSQL pricing - https://aws.amazon.com/rds/postgresql/pricing/
[4] Industry news - https://news.example/roundup

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone Asia/Calcutta, today is Mon 16 Nov 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

Dates found in the user's message and what was found for each:
- "Last Tuesday" -> Tue 10 Nov 2026: 1 turn

## Tue 10 Nov 2026 (1 turn, for "Last Tuesday")

### Turn 1: Tue 10 Nov 2026, 10:15 (date for searches: 2026-11-10), chat "[demo] Postgres hosting prices" [demo data]
The user asked:
Compare managed Postgres hosting for a small SaaS: Neon, Supabase and AWS RDS. Entry-level pricing please.

You answered:
Entry-level managed Postgres, as of 10 November 2026:

| Provider | Entry plan | Price | Notes |
| --- | --- | --- | --- |
| Neon | Launch | $19/month [1] | Scales to zero, branching |
| Supabase | Pro | $25/month [2] | 8 GB database included |
| AWS RDS | db.t4g.micro | about $12/month plus storage [3] | No free tier after 12 months |

For a small SaaS, Supabase Pro is the simplest all-in-one; Neon is cheapest if traffic is bursty.

Sources you cited in that answer (its [n] numbers refer to this list):
[1] Neon pricing - https://neon.tech/pricing
[2] Supabase pricing - https://supabase.com/pricing
[3] Amazon RDS for PostgreSQL pricing - https://aws.amazon.com/rds/postgresql/pricing/

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- Neon | Launch plan price per month | $19 | as of 2026-11-10 | https://neon.tech/pricing
- Supabase | Pro plan price per month | $25 | as of 2026-11-10 | https://supabase.com/pricing
- AWS RDS for PostgreSQL | db.t4g.micro approximate price per month | about $12 plus storage | as of 2026-11-10 | https://aws.amazon.com/rds/postgresql/pricing/

## Conversations matching the topic (postgres, hosting, pricing), found by keyword search, any date

### Turn 2: Mon 2 Nov 2026, 10:15 (date for searches: 2026-11-02), chat "[demo] Managed vector database pricing" [demo data]
The user asked:
Compare managed vector database hosting for a small RAG app: Pinecone, Qdrant Cloud and Weaviate Cloud. Entry-level pricing please.

You answered:
Entry-level managed vector databases, as of 2 November 2026:

| Provider | Entry plan | Price | Notes |
| --- | --- | --- | --- |
| Pinecone | Standard | $50/month minimum [1] | Serverless, pay for usage above the minimum |
| Qdrant Cloud | Free cluster | $0 for 1 GB [2] | Good for prototypes, paid tiers scale by node |
| Weaviate Cloud | Flex | from $45/month [3] | Pay as you go with a monthly floor |

For a small RAG app, Qdrant's free cluster is the cheapest way to start.

Sources you cited in that answer (its [n] numbers refer to this list):
[1] Pinecone pricing - https://www.pinecone.io/pricing/
[2] Qdrant Cloud pricing - https://qdrant.tech/pricing/
[3] Weaviate Cloud pricing - https://weaviate.io/pricing

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- Pinecone | Standard plan minimum per month | $50 | as of 2026-11-02 | https://www.pinecone.io/pricing/
- Qdrant Cloud | Free cluster size | 1 GB | as of 2026-11-02 | https://qdrant.tech/pricing/
- Weaviate Cloud | Flex plan starting price per month | $45 | as of 2026-11-02 | https://weaviate.io/pricing
```

</details>

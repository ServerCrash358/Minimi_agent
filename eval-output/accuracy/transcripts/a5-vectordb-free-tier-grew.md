# Vector databases: Qdrant's free tier changed, the others did not

**Result:** PASS  
**Why this case exists:** A change that is not a price: the free cluster grew. 'Two weeks ago' is a date range, and the TypeScript chat inside that range must not pull in an irrelevant check.

## Question

Two weeks ago I asked you about vector database hosting. Has any pricing changed since then?

## Checks

- [x] produced an answer
- [x] recalled the "vectordb" conversation (Mon 2 Nov 2026)
- [x] Pinecone: unchanged
- [x] Qdrant: changed
- [x] Weaviate: unchanged
- [x] does not drag in the unrelated TypeScript chat

## Timing

First token 1.4 s, answer starts 3.6 s, total 5.8 s, 2 model step(s).

## Searches

- `Pinecone pricing plans` (site pinecone.io): 1 results, 0 ms
- `Qdrant Cloud latest stable release` (site qdrant.tech): 1 results, 0 ms
- `Weaviate Cloud pricing plans` (site weaviate.io): 1 results, 0 ms
- `Pinecone, Qdrant Cloud, Weaviate Cloud pricing changes and new announcements` (since 2026-11-02): 1 results, 0 ms
- `Pinecone pricing plans`: 1 results, 0 ms
- `Qdrant Cloud latest stable release`: 1 results, 0 ms
- `Weaviate Cloud pricing plans`: 1 results, 0 ms
- `Pinecone, Qdrant Cloud, Weaviate Cloud pricing changes and new announcements` (since 2026-11-02): 1 results, 0 ms

## Answer

As of 16 November 2026, the pricing for Pinecone, Qdrant Cloud, and Weaviate Cloud has not changed since the user's previous inquiry two weeks ago.

| Item | Then (2 November 2026) | Now | Verdict | Source |
| --- | --- | --- | --- | --- |
| Pinecone Standard plan minimum per month | $50 | $50 | Unchanged | [1] |
| Qdrant Cloud free cluster size | 1 GB | 4 GB | Changed | [2] |
| Weaviate Cloud Flex plan starting price per month | $45 | $45 | Unchanged | [3] |

[1] Pinecone pricing - https://www.pinecone.io/pricing/
[2] Qdrant Cloud pricing - https://qdrant.tech/pricing/
[3] Weaviate Cloud pricing - https://weaviate.io/pricing
[4] Industry news - https://news.example/roundup

The Qdrant Cloud free cluster size has changed from 1 GB to 4 GB, while the pricing for Pinecone and Weaviate Cloud remains unchanged.

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone Asia/Calcutta, today is Mon 16 Nov 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

Dates found in the user's message and what was found for each:
- "Two weeks ago" -> Fri 30 Oct to Thu 5 Nov 2026: 3 turns. "Two weeks ago" is approximate: searched three days either side of Mon 2 Nov 2026.

## Fri 30 Oct to Thu 5 Nov 2026 (3 turns, for "Two weeks ago")

### Turn 1: Mon 2 Nov 2026, 10:15 (date for searches: 2026-11-02), chat "[demo] Managed vector database pricing" [demo data]
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

### Turn 2: Tue 3 Nov 2026, 10:15 (date for searches: 2026-11-03), chat "[demo] Latest Python version" [demo data]
The user asked:
What is the latest stable Python version, and when does it reach end of life?

You answered:
As of 3 November 2026, the latest stable release is Python 3.14 [1]. It is supported with bug fixes until October 2027 and security fixes until October 2030 [1].

Sources you cited in that answer (its [n] numbers refer to this list):
[1] Python status of versions - https://devguide.python.org/versions/

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- Python | latest stable version | 3.14 | as of 2026-11-03 | https://devguide.python.org/versions/
- Python 3.14 | end of security support | October 2030 | as of 2026-11-03 | https://devguide.python.org/versions/

### Turn 3: Thu 5 Nov 2026, 10:15 (date for searches: 2026-11-05), chat "[demo] Latest TypeScript version" [demo data]
The user asked:
What is the latest stable TypeScript version, and what is notable about it?

You answered:
As of 5 November 2026, the latest stable release is TypeScript 5.9 [1]. Notable additions are import defer, support for --module node20, and a smaller default tsconfig from tsc --init [1].

Sources you cited in that answer (its [n] numbers refer to this list):
[1] TypeScript release notes - https://www.typescriptlang.org/docs/handbook/release-notes/overview.html

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- TypeScript | latest stable version | 5.9 | as of 2026-11-05 | https://www.typescriptlang.org/docs/handbook/release-notes/overview.html

## Conversations matching the topic (vector, database, hosting, pricing), found by keyword search, any date

### Turn 4: Tue 10 Nov 2026, 10:15 (date for searches: 2026-11-10), chat "[demo] Postgres hosting prices" [demo data]
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
```

</details>

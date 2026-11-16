# 'Two weeks ago': vector database hosting

**Result:** PASS  
**Why this case exists:** Sample 3's kind (a past conversation about hosting prices, 'has pricing changed') reached by a different relative phrase, 'two weeks ago', which is a date range, not a day.

## Question

Two weeks ago I asked you about vector database hosting. Has any pricing changed since then?

## Checks

- [x] produced an answer
- [x] recalled the "vectordb" conversation (Mon 2 Nov 2026)
- [x] ran 2+ searches
- [x] searched 2+ distinct vendor sites
- [x] uses a table
- [x] answer covers Pinecone
- [x] answer covers Qdrant
- [x] answer gives a changed/unchanged verdict
- [x] cites 2+ distinct sources
- [x] facts were extracted and stored after the answer

## Timing

First token 1.5 s, answer starts 10.8 s, total 12.6 s, 2 model step(s).

## Searches

- `Pinecone pricing plans` (site pinecone.io): 2 results, 1 ms, cached
- `Qdrant Cloud latest stable release` (site qdrant.tech): 3 results, 0 ms, cached
- `Weaviate Cloud pricing plans` (site weaviate.io): 3 results, 0 ms, cached
- `Pinecone, Qdrant Cloud, Weaviate Cloud pricing changes and new announcements` (since 2026-11-02): 4 results, 0 ms, cached
- `Pinecone pricing changes since November 2, 2026` (since 2026-11-02): 4 results, 2688 ms
- `Qdrant Cloud pricing changes since November 2, 2026` (since 2026-11-02): 4 results, 2871 ms
- `Weaviate Cloud pricing changes since November 2, 2026` (since 2026-11-02): 5 results, 2114 ms

## Answer

As of 16 November 2026, here are the changes in vector database hosting pricing since your last inquiry:

| Item | Then (date) | Now | Verdict | Source |
| --- | --- | --- | --- | --- |
| Pinecone Standard plan minimum per month | $50 (as of 2 Nov 2026) | $50 | Unchanged | [9] |
| Pinecone Builder plan price | Not recorded | $20/month flat | New plan | [9] |
| Qdrant Cloud Free cluster size | 1 GB (as of 2 Nov 2026) | Not found | Changed | [18] |
| Weaviate Cloud Flex plan starting price per month | $45 (as of 2 Nov 2026) | $45 | Unchanged | [13] |

Summary: Pinecone's Standard plan minimum and Weaviate Cloud's Flex plan starting price remain unchanged. Pinecone introduced a new Builder plan at $20/month flat. Qdrant Cloud's Free cluster size could not be verified as the earlier value was not found in the current search results.

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone Asia/Calcutta, today is Mon 16 Nov 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

Dates found in the user's message and what was found for each:
- "Two weeks ago" -> Fri 30 Oct to Thu 5 Nov 2026: 2 turns. "Two weeks ago" is approximate: searched three days either side of Mon 2 Nov 2026.

## Fri 30 Oct to Thu 5 Nov 2026 (2 turns, for "Two weeks ago")

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

### Turn 2: Thu 5 Nov 2026, 10:15 (date for searches: 2026-11-05), chat "[demo] Latest TypeScript version" [demo data]
The user asked:
What is the latest stable TypeScript version, and what is notable about it?

You answered:
As of 5 November 2026, the latest stable release is TypeScript 5.9 [1]. Notable additions are import defer, support for --module node20, and a smaller default tsconfig from tsc --init [1].

Sources you cited in that answer (its [n] numbers refer to this list):
[1] TypeScript release notes - https://www.typescriptlang.org/docs/handbook/release-notes/overview.html

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- TypeScript | latest stable version | 5.9 | as of 2026-11-05 | https://www.typescriptlang.org/docs/handbook/release-notes/overview.html
```

</details>

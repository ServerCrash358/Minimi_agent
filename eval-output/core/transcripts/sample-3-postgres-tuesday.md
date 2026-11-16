# Sample 3: Postgres hosting asked last Tuesday

**Result:** PASS  
**Why this case exists:** 'last Tuesday' read two ways, recalled prices, vendor pricing pages (not date-filtered news), diff table, facts stored.

## Question

Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?

## Checks

- [x] produced an answer
- [x] recalled the "postgres" conversation (Tue 10 Nov 2026)
- [x] ran 3+ searches
- [x] searched 2+ distinct vendor sites
- [x] uses a table
- [x] answer covers Neon
- [x] answer covers Supabase
- [x] answer gives a changed/unchanged verdict
- [x] cites 2+ distinct sources
- [x] facts were extracted and stored after the answer

## Timing

First token 4.3 s, answer starts 10.6 s, total 12.7 s, 2 model step(s).

## Searches

- `Neon pricing plans` (site neon.tech): 3 results, 1 ms, cached
- `Supabase pricing plans` (site supabase.com): 2 results, 0 ms, cached
- `AWS RDS for PostgreSQL pricing plans` (site aws.amazon.com): 3 results, 0 ms, cached
- `Neon, Supabase, AWS RDS for PostgreSQL pricing changes and new announcements` (since 2026-11-10): 5 results, 0 ms, cached
- `Neon pricing plans` (site neon.tech): 3 results, 1 ms, cached
- `Supabase pricing plans` (site supabase.com): 2 results, 0 ms, cached
- `AWS RDS for PostgreSQL pricing plans` (site aws.amazon.com): 3 results, 0 ms, cached

## Answer

As of 16 November 2026, here are the changes in Postgres hosting pricing since 10 November 2026:

| Provider | Item | Then (10 Nov 2026) | Now | Verdict | Source |
| --- | --- | --- | --- | --- | --- |
| Neon | Launch plan price per month | $19 | Usage-based at $0.106 per CU-hour and $0.35 per GB-month | Changed | [1][2][3] |
| Supabase | Pro plan price per month | $25 | From $25/month, including 8 GB disk size per project and $10/month in compute credits | Unchanged | [4][5] |
| AWS RDS for PostgreSQL | db.t4g.micro approximate price per month | About $12 plus storage | Varies by region and usage, see [6] for details | Changed | [6] |

Summary: Neon's Launch plan pricing has changed to a usage-based model, while Supabase's Pro plan remains unchanged. AWS RDS for PostgreSQL's pricing for db.t4g.micro instances now varies by region and usage.

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
```

</details>

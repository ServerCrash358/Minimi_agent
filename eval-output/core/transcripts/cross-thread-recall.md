# Recall across threads, no date given

**Result:** PASS  
**Why this case exists:** A new chat refers to an old one by topic only. Found by full-text search, not by date.

## Question

In an earlier chat I asked you about Postgres hosting. Which provider did you say was cheapest to start with?

## Checks

- [x] produced an answer
- [x] recalled the "postgres" conversation (Tue 10 Nov 2026)
- [x] answer names a provider from that chat

## Timing

First token 3.3 s, answer starts 10.3 s, total 11.7 s, 3 model step(s).

## Searches

- `cheapest Postgres hosting provider` (site open-assistant.io): 0 results, 1370 ms
- `Postgres hosting prices` (site open-assistant.io): 0 results, 1092 ms

## Answer

Based on the prior conversations block, in the conversation on Tuesday 10 November 2026, I mentioned that Neon's Launch plan was the cheapest to start with, priced at $19 per month. However, in the conversation on Monday 16 November 2026, I updated the pricing information and mentioned that Neon's Launch plan had changed to a usage-based model with a typical spend of $15 per month. Supabase Pro plan and AWS RDS for PostgreSQL pricing remained unchanged.

Therefore, as of 16 November 2026, Neon's usage-based model with a typical spend of $15 per month is the cheapest option to start with for managed Postgres hosting.

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone Asia/Calcutta, today is Mon 16 Nov 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

## Conversations matching the topic (postgres, hosting, provider, cheapest, start), found by keyword search, any date

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

### Turn 2: Mon 16 Nov 2026, 19:56 (date for searches: 2026-11-16), chat "Last Tuesday I asked you about Postgres hosting. Has any pri"
The user asked:
Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?

You answered:
As of 16 November 2026, here are the changes in pricing for managed Postgres hosting since last Tuesday:

| Item | Then (10 Nov 2026) | Now | Verdict | Source |
| --- | --- | --- | --- | --- |
| Neon Launch plan price per month | $19 | Usage-based, typical spend $15/mo | Changed | [6] |
| Supabase Pro plan price per month | $25 | $25 | Unchanged | [2] |
| AWS RDS for PostgreSQL db.t4g.micro approximate price per month | about $12 plus storage | about $12 plus storage | Unchanged | [7] |

Neon's Launch plan has changed to a usage-based model with a typical spend of $15 per month. Supabase Pro plan and AWS RDS for PostgreSQL pricing remain unchanged.

Sources you cited in that answer (its [n] numbers refer to this list):
[1] Pricing | Supabase Docs - https://supabase.com/docs/guides/functions/pricing (published 2026-10-12)
[2] Pricing & Fees | Supabase - https://supabase.com/pricing
[3] Manage Storage size usage | Supabase Docs - https://supabase.com/docs/guides/platform/manage-your-usage/storage-size (published 2026-11-07)
[4] Neon’s New Pricing, Explained: Usage-Based, No Minimum - Neon - https://neon.tech/unify?a=60b78afa-0fce-41f2-99a7-0fa7656a57fa&n=blog%2Fnew-usage-based-pricing (published 2025-08-14)
[5] Making pricing more predictable - Neon - https://neon.tech/blog/making-pricing-more-predictable (published 2024-02-19)
[6] Neon Pricing: Free Plan With 100 Projects, Typical Spend $15/Month - https://neon.tech/pricing (published 2026-10-30)
[7] Amazon RDS for PostgreSQL Pricing - https://aws.amazon.com/rds/postgresql/pricing (published 2014-01-10)
[8] Managed Relational Database - Amazon RDS Pricing - Amazon Web Services - https://aws.amazon.com/rds/pricing (published 2010-03-31)
[9] Estimating the charges for Amazon RDS Extended Support | AWS Cloud Financial Management - https://aws.amazon.com/blogs/aws-cloud-financial-management/estimating-the-charges-for-amazon-rds-extended-support (published 2024-03-25)

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- Neon Launch plan | price per month | Usage-based, typical spend $15/mo | as of 2026-11-16 | https://neon.tech/pricing
- Supabase Pro plan | price per month | $25 | as of 2026-11-16 | https://supabase.com/pricing
- AWS RDS for PostgreSQL | approximate price per month | about $12 plus storage | as of 2026-11-16 | https://aws.amazon.com/rds/postgresql/pricing
```

</details>

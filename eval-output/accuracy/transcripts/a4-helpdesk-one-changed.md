# Helpdesk: Intercom changed, the other three did not

**Result:** PASS  
**Why this case exists:** Held-out topic and weekday; one price up, three the same.

## Question

On Thursday we shortlisted 4 helpdesk tools for a 12-person support team. Has any of them changed pricing or launched something big since?

## Checks

- [x] produced an answer
- [x] recalled the "helpdesk" conversation (Thu 12 Nov 2026)
- [x] Zendesk: unchanged
- [x] Freshdesk: unchanged
- [x] Help Scout: unchanged
- [x] Intercom: changed

## Timing

First token 2.6 s, answer starts 6.5 s, total 9.6 s, 2 model step(s).

## Searches

- `Zendesk pricing plans` (site zendesk.com): 1 results, 0 ms
- `Freshdesk pricing plans` (site freshworks.com): 1 results, 0 ms
- `Help Scout pricing plans` (site helpscout.com): 1 results, 0 ms
- `Intercom pricing plans` (site intercom.com): 1 results, 0 ms
- `TypeScript latest stable release` (site typescriptlang.org): 0 results, 0 ms
- `Zendesk, Freshdesk, Help Scout, Intercom, TypeScript pricing changes and new announcements` (since 2026-11-05): 1 results, 0 ms
- `Zendesk, Freshdesk, Help Scout, Intercom pricing changes and new announcements` (since 2026-11-12): 1 results, 0 ms

## Answer

As of 16 November 2026, here is the comparison of the helpdesk tools' pricing since the shortlist on 12 November 2026:

| Tool | Then (12 Nov 2026) | Now (16 Nov 2026) | Verdict | Source |
| --- | --- | --- | --- | --- |
| Zendesk | $55 per agent per month | $55 per agent per month | Unchanged | [1] |
| Freshdesk | $49 per agent per month | $49 per agent per month | Unchanged | [2] |
| Help Scout | $50 per user per month | $50 per user per month | Unchanged | [3] |
| Intercom | $29 per seat per month | $39 per seat per month | Changed | [4] |

Summary: Intercom's Essential plan price per seat per month has increased from $29 to $39. The other tools' pricing remains unchanged.

[1] Zendesk pricing - https://www.zendesk.com/pricing/
[2] Freshdesk pricing - https://www.freshworks.com/freshdesk/pricing/
[3] Help Scout pricing - https://www.helpscout.com/pricing/
[4] Intercom pricing - https://www.intercom.com/pricing
[5] Industry news - https://news.example/roundup

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone Asia/Calcutta, today is Mon 16 Nov 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

Dates found in the user's message and what was found for each:
- "On Thursday" (ambiguous) -> Thu 12 Nov 2026: 1 turn; Thu 5 Nov 2026: 1 turn. "On Thursday" is ambiguous (this week's or the week before's). All were checked.

## Thu 12 Nov 2026 (1 turn, for "On Thursday")

### Turn 1: Thu 12 Nov 2026, 10:15 (date for searches: 2026-11-12), chat "[demo] Helpdesk shortlist for a 12-person support team" [demo data]
The user asked:
Shortlist 4 helpdesk tools for a 12-person support team. Give me the price per agent for each.

You answered:
Shortlist for a 12-person support team, as of 12 November 2026:

| Tool | Plan | Price per agent / month | Why it fits |
| --- | --- | --- | --- |
| Zendesk | Suite Team | $55 [1] | Most complete, heavier to set up |
| Freshdesk | Pro | $49 [2] | Good automation for the price |
| Help Scout | Standard | $50 [3] | Simple shared inbox, easy to adopt |
| Intercom | Essential | $29 [4] | Best chat experience, add-ons cost extra |

At 12 agents, Intercom Essential is about $348/month and Zendesk Suite Team about $660/month.

Sources you cited in that answer (its [n] numbers refer to this list):
[1] Zendesk pricing - https://www.zendesk.com/pricing/
[2] Freshdesk pricing - https://www.freshworks.com/freshdesk/pricing/
[3] Help Scout pricing - https://www.helpscout.com/pricing/
[4] Intercom pricing - https://www.intercom.com/pricing

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- Zendesk | Suite Team price per agent per month | $55 | as of 2026-11-12 | https://www.zendesk.com/pricing/
- Freshdesk | Pro price per agent per month | $49 | as of 2026-11-12 | https://www.freshworks.com/freshdesk/pricing/
- Help Scout | Standard price per user per month | $50 | as of 2026-11-12 | https://www.helpscout.com/pricing/
- Intercom | Essential price per seat per month | $29 | as of 2026-11-12 | https://www.intercom.com/pricing

## Thu 5 Nov 2026 (1 turn, for "On Thursday")

### Turn 2: Thu 5 Nov 2026, 10:15 (date for searches: 2026-11-05), chat "[demo] Latest TypeScript version" [demo data]
The user asked:
What is the latest stable TypeScript version, and what is notable about it?

You answered:
As of 5 November 2026, the latest stable release is TypeScript 5.9 [1]. Notable additions are import defer, support for --module node20, and a smaller default tsconfig from tsc --init [1].

Sources you cited in that answer (its [n] numbers refer to this list):
[1] TypeScript release notes - https://www.typescriptlang.org/docs/handbook/release-notes/overview.html

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- TypeScript | latest stable version | 5.9 | as of 2026-11-05 | https://www.typescriptlang.org/docs/handbook/release-notes/overview.html

## Conversations matching the topic (helpdesk, person, support, team, pricing, launched, something, big), found by keyword search, any date

### Turn 3: Mon 9 Nov 2026, 10:15 (date for searches: 2026-11-09), chat "[demo] CRM shortlist for a 20-person sales team" [demo data]
The user asked:
Shortlist 5 CRM tools for a 20-person sales team. Give me the price per seat for each.

You answered:
Here is a shortlist for a 20-person sales team, as of 9 November 2026:

| Tool | Plan | Price per seat / month | Why it fits |
| --- | --- | --- | --- |
| HubSpot Sales Hub | Starter | $20 [1] | Easiest to adopt, strong free tier |
| Pipedrive | Advanced | $34 [2] | Pipeline-first, good for small teams |
| Zoho CRM | Professional | $23 [3] | Cheapest with automation |
| Salesforce | Starter Suite | $25 [4] | Grows into enterprise features |
| Freshsales | Growth | $11 [5] | Lowest cost, built-in phone |

At 20 seats, HubSpot Starter is about $400/month and Freshsales about $220/month.

Sources you cited in that answer (its [n] numbers refer to this list):
[1] HubSpot Sales Hub pricing - https://www.hubspot.com/pricing/sales
[2] Pipedrive pricing - https://www.pipedrive.com/en/pricing
[3] Zoho CRM pricing - https://www.zoho.com/crm/pricing/
[4] Salesforce Sales pricing - https://www.salesforce.com/sales/pricing/
[5] Freshsales pricing - https://www.freshworks.com/crm/pricing/

Claims recorded from that answer (entity | attribute | value | as-of date | source):
- HubSpot Sales Hub | Starter price per seat per month | $20 | as of 2026-11-09 | https://www.hubspot.com/pricing/sales
- Pipedrive | Advanced price per seat per month | $34 | as of 2026-11-09 | https://www.pipedrive.com/en/pricing
- Zoho CRM | Professional price per seat per month | $23 | as of 2026-11-09 | https://www.zoho.com/crm/pricing/
- Salesforce Sales | Starter Suite price per seat per month | $25 | as of 2026-11-09 | https://www.salesforce.com/sales/pricing/
- Freshsales | Growth price per seat per month | $11 | as of 2026-11-09 | https://www.freshworks.com/crm/pricing/

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

# Multi-entity comparison

**Result:** PASS  
**Why this case exists:** Three entities should be searched in parallel in one step, then compared in a table with citations.

## Question

Compare pricing for Linear, Jira and Asana for a 10-person team.

## Checks

- [x] produced an answer
- [x] ran 3+ searches
- [x] finished in <= 3 model steps (searches issued in parallel)
- [x] uses a table
- [x] cites 3+ distinct sources
- [x] did not consult memory

## Timing

First token 3.2 s, answer starts 10.4 s, total 13.0 s, 2 model step(s).

## Searches

- `Linear pricing` (site linear.app): 3 results, 3460 ms
- `Jira pricing` (site atlassian.com): 3 results, 1929 ms
- `Asana pricing` (site asana.com): 3 results, 3197 ms

## Answer

As of 16 November 2026, the pricing comparison for Linear, Jira, and Asana for a 10-person team is as follows:

| Tool | Plan | Price per User/Month | Total for 10 Users/Month |
| --- | --- | --- | --- |
| Linear | Basic | $10 | $100 |
| Linear | Business | $16 | $160 |
| Jira | Standard | $10.70 (based on tier pricing) | $107 |
| Asana | Starter | $10.99 | $109.90 |
| Asana | Advanced | $24.99 | $249.90 |

**Summary:**
- Linear offers two plans: Basic at $10 per user/month and Business at $16 per user/month.
- Jira's Standard plan is priced at $10.70 per user/month for a 10-person team, based on tier pricing.
- Asana offers Starter at $10.99 per user/month and Advanced at $24.99 per user/month.

[1][2][4]


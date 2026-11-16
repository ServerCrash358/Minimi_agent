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

First token 0.8 s, total 11.2 s, 2 model step(s).

## Searches

- `Linear pricing for 10-person team` (site linear.app): 3 results, 2061 ms
- `Jira pricing for 10-person team` (site atlassian.com): 3 results, 2240 ms
- `Asana pricing for 10-person team` (site asana.com): 3 results, 4189 ms

## Answer

As of 16 November 2026, here's a comparison of the pricing for Linear, Jira, and Asana for a 10-person team:

| Tool | Pricing for 10-person team |
| --- | --- |
| Linear | Free for up to 10 users [1] |
| Jira | Free for up to 10 users [6] |
| Asana | Free for up to 10 users [8] |

All three tools offer a free plan that supports up to 10 users. For larger teams or additional features, each tool has different paid plans with varying prices.


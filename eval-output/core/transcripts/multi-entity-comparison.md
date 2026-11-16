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

First token 0.9 s, answer starts 10.0 s, total 11.5 s, 2 model step(s).

## Searches

- `Linear pricing for 10-person team` (site linear.app): 3 results, 2955 ms
- `Jira pricing for 10-person team` (site atlassian.com): 3 results, 3727 ms
- `Asana pricing for 10-person team` (site asana.com): 3 results, 3097 ms

## Answer

As of 16 November 2026, the pricing for a 10-person team is as follows:

| Service | Plan | Price per user/month |
| --- | --- | --- |
| Linear | Basic | $10 [1] |
| Jira | Free | $0 (up to 10 users) [8] |
| Asana | Starter | $10.99 (billed annually) [6] |

**Summary:** Linear's Basic plan costs $10 per user per month, Jira offers a free plan for up to 10 users, and Asana's Starter plan is $10.99 per user per month when billed annually.

[1] https://linear.app/pricing
[6] https://asana.com/resources/best-project-management-software
[8] https://www.atlassian.com/software/jira/guides/more/jira-editions


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

First token 1.8 s, answer starts 8.3 s, total 9.5 s, 2 model step(s).

## Searches

- `pricing` (site linear.app): 3 results, 3255 ms
- `Jira pricing` (site atlassian.com): 3 results, 1507 ms
- `pricing` (site asana.com): 3 results, 3391 ms

## Answer

As of 16 November 2026, here is the pricing comparison for a 10-person team:

| Tool       | Plan          | Monthly Cost  |
|------------|---------------|---------------|
| Linear     | Basic         | $100          |
| Jira       | Standard      | $86           |
| Asana      | Advanced      | $249.90       |

**Notes:**
- Linear's Basic plan costs $10 per user per month [4].
- Jira's Standard plan costs $8.60 per user per month for the first 100 users [2].
- Asana's Advanced plan costs $24.99 per user per month billed annually [7].

This comparison is based on the standard pricing for each tool without any discounts or additional features.


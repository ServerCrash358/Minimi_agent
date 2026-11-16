# Shortlist recalled by weekday: four helpdesk tools

**Result:** PASS  
**Why this case exists:** Sample 1's kind (weekday, shortlist, 'changed or shipped something big') with different tools, weekday and team size. 'Thursday' is ambiguous; a second conversation may sit on the other reading.

## Question

On Thursday we shortlisted 4 helpdesk tools for a 12-person support team. Has any of them changed pricing or launched something big since?

## Checks

- [x] produced an answer
- [x] recalled the "helpdesk" conversation (Thu 12 Nov 2026)
- [x] searched 3+ distinct vendor sites
- [x] finished in <= 3 model steps (searches issued in parallel)
- [x] cites 3+ distinct sources
- [x] answer gives a changed/unchanged verdict

## Timing

First token 1.4 s, answer starts 14.3 s, total 18.0 s, 2 model step(s).

## Searches

- `Zendesk pricing` (site zendesk.com): 3 results, 2948 ms
- `Freshdesk pricing` (site freshworks.com): 3 results, 2327 ms
- `Help Scout pricing` (site helpscout.com): 3 results, 4260 ms
- `Intercom pricing` (site intercom.com): 3 results, 5106 ms
- `Zendesk announcements since 2026-11-12`: 5 results, 2974 ms
- `Freshdesk announcements since 2026-11-12`: 5 results, 2371 ms
- `Help Scout announcements since 2026-11-12`: 5 results, 2386 ms
- `Intercom announcements since 2026-11-12`: 5 results, 2325 ms

## Answer

As of 16 November 2026, here is the comparison of pricing and major announcements since 12 November 2026 for Zendesk, Freshdesk, Help Scout, and Intercom:

| Tool | Then (12 Nov 2026) | Now | Verdict | Source |
| --- | --- | --- | --- | --- |
| Zendesk | Suite Team: $55/agent/month | Suite Team: $55/agent/month (annual), $69/agent/month (monthly) | Unchanged | [19][21] |
| Freshdesk | Pro: $49/agent/month | Pro: $79/agent/month | Changed | [1][2] |
| Help Scout | Standard: $50/user/month | Standard: $25/user/month | Changed | [27][29] |
| Intercom | Essential: $29/seat/month | Essential: $19/seat/month | Changed | [30][31] |

### Summary of Changes:
- **Zendesk**: Pricing remains unchanged. Recent announcements include support for Jira Data Center 11.3 LTS and improvements to AI agents and Copilot [22][23][24][25].
- **Freshdesk**: Pro plan price increased from $49 to $79 per agent per month. Recent updates include enhancements to contact views and the introduction of Voice AI Agents [9][10][11][12].
- **Help Scout**: Standard plan price decreased from $50 to $25 per user per month. Recent updates include support for Next Response Time goals and SMS integration [15][17][18].
- **Intercom**: Essential plan price decreased from $29 to $19 per seat per month. Recent announcements include the introduction of Fin 4 and updates to the Fin AI Agent [4][5][7][8].

For detailed pricing and features, please refer to the respective tool's pricing page.

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
```

</details>

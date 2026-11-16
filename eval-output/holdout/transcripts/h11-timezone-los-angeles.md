# Timezone: Los Angeles, across the DST change

**Result:** PASS  
**Why this case exists:** At 23:30 on 8 March in Los Angeles it is already the 9th in UTC. 'Yesterday' is the 7th for them; a UTC server would look on the 8th and find nothing.

## Question

What did I ask you yesterday? Remind me what you answered.

## Checks

- [x] produced an answer
- [x] found the conversation from the user's local yesterday
- [x] answer mentions what was asked (Figma)

## Timing

First token 2.4 s, answer starts 2.4 s, total 3.0 s, 1 model step(s).

## Searches

None.

## Answer

You asked: "How much is Figma Professional per seat?"
I answered: "Figma Professional is $15 per editor per month, billed annually."

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone America/Los_Angeles, today is Sun 8 Mar 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

Dates found in the user's message and what was found for each:
- "yesterday" -> Sat 7 Mar 2026: 1 turn

## Sat 7 Mar 2026 (1 turn, for "yesterday")

### Turn 1: Sat 7 Mar 2026, 02:00 (date for searches: 2026-03-07), chat "[demo] Figma pricing"
The user asked:
How much is Figma Professional per seat?

You answered:
Figma Professional is $15 per editor per month, billed annually.
```

</details>

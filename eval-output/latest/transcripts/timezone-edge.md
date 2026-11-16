# Timezone: the user's 'yesterday', not the server's

**Result:** PASS  
**Why this case exists:** In Auckland it is already the 12th while UTC is still the 11th. 'Yesterday' must be the 11th for them; a UTC server would look on the 10th and find nothing.

## Question

What did I ask you yesterday?

## Checks

- [x] produced an answer
- [x] found the conversation from the user's local yesterday
- [x] answer mentions what was asked (Linear)

## Timing

First token 2.1 s, answer starts 2.1 s, total 2.4 s, 1 model step(s).

## Searches

None.

## Answer

Yesterday, you asked:

"How much does Linear cost per seat?"

My answer was:

"Linear Standard is $10 per user per month, billed annually."

If you need to check if this is still current, let me know.

<details><summary>Memory block the model saw</summary>

```
# Prior conversations
Retrieved from this user's stored history (timezone Pacific/Auckland, today is Thu 12 Mar 2026). This is the complete record: anything not listed here was not stored.
Citation numbers like [1] inside prior answers refer to that answer's own source list, not to your new search results.
If the user is not actually asking about an earlier conversation, ignore this section.

Dates found in the user's message and what was found for each:
- "yesterday" -> Wed 11 Mar 2026: 1 turn

## Wed 11 Mar 2026 (1 turn, for "yesterday")

### Turn 1: Wed 11 Mar 2026, 18:00 (date for searches: 2026-03-11), chat "[demo] Linear pricing"
The user asked:
How much does Linear cost per seat?

You answered:
Linear Standard is $10 per user per month, billed annually.
```

</details>

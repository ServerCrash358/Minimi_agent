# Ambiguous 'last week'

**Result:** FAIL  
**Why this case exists:** 'Last week' is a calendar week or the past seven days; both are searched and the Postgres chat (last week's Tuesday) is found either way.

## Question

What did we discuss last week?

## Checks

- [ ] produced an answer (no answer (The model returned an empty answer.))
- [ ] recalled the "postgres" conversation (Tue 10 Nov 2026) (that turn was not in the memory block)
- [ ] answer mentions the Postgres conversation (answer does not match /postgres/i)
- [ ] resolved 'last week' as a date reference (no 'last week' reference)

## Timing

First token n/a, answer starts n/a, total n/a, 0 model step(s).  
Error: The model returned an empty answer.

## Searches

None.

## Answer

(no answer)


# A question that needs no search

**Result:** PASS  
**Why this case exists:** Stable knowledge answered directly: no tool, no memory lookup, short.

## Question

Explain the difference between a left join and an inner join.

## Checks

- [x] produced an answer
- [x] did not search
- [x] did not consult memory
- [x] answer is about joins
- [x] is short (under 2500 characters)

## Timing

First token 1.7 s, answer starts 1.7 s, total 2.8 s, 1 model step(s).

## Searches

None.

## Answer

A left join returns all records from the left table and the matched records from the right table. If there is no match, the result is NULL on the right side. An inner join returns only the records that have matching values in both tables. 

| Join Type | Result Description |
|-----------|--------------------|
| Left Join | All left table rows, matched right table rows where available. |
| Inner Join | Only rows with matches in both tables. |


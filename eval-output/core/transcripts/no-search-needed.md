# A question that needs no search

**Result:** PASS  
**Why this case exists:** Stable knowledge is answered directly: fast, no tool call, no memory lookup, short.

## Question

What is a database index and when would I use one?

## Checks

- [x] produced an answer
- [x] did not search
- [x] did not consult memory
- [x] answer is about indexes
- [x] is short (under 2500 characters)

## Timing

First token 0.9 s, answer starts 0.9 s, total 2.1 s, 1 model step(s).

## Searches

None.

## Answer

A database index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional writes and storage space to maintain the index data structure. Indexes are used to quickly locate data without having to search every row in a database table every time a database table is accessed.

You would use a database index when:
- You need to speed up the retrieval of data, especially for large tables.
- You frequently query a specific column or set of columns.
- You have a large table and need to improve query performance.
- You want to enforce uniqueness on a column (unique index).

Indexes are particularly useful for columns that are often used in the WHERE clause of SQL queries, in JOIN operations, or as foreign keys.


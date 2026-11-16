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

First token 1.3 s, answer starts 1.3 s, total 2.9 s, 1 model step(s).

## Searches

None.

## Answer

A database index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional writes and the use of more storage space to maintain the extra copy of data. Data can be stored only in one order on disk, but with the index, it can be accessed in more than one way.

Indexes are used to quickly locate data without having to search every row in a database table every time a database table is accessed. Indexes can be created using one or more columns of a database table, providing the basis for both rapid random lookups and efficient access of ordered records.

Here's when you would use a database index:
- When you need to speed up select queries that filter results based on specific column values.
- When you want to enforce uniqueness for a column (using a unique index).
- When you need to improve the performance of join operations between tables.
- When you want to sort query results efficiently.

In summary, database indexes are essential for optimizing query performance and ensuring efficient data retrieval in large databases.


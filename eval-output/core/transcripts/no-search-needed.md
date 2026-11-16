# A question that needs no search

**Result:** FAIL  
**Why this case exists:** Stable knowledge is answered directly: fast, no tool call, no memory lookup, short.

## Question

What is a database index and when would I use one?

## Checks

- [x] produced an answer
- [ ] did not search (searched 1x)
- [x] did not consult memory
- [x] answer is about indexes
- [x] is short (under 2500 characters)

## Timing

First token 0.6 s, answer starts 4.1 s, total 6.7 s, 2 model step(s).

## Searches

- `what is a database index and when to use one`: 5 results, 1338 ms

## Answer

A database index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional writes and storage space to maintain the index data structure. Indexes are used to quickly locate data without having to search every row in a database table every time a database table is accessed [1][3].

You would use a database index when you need to improve the performance of data retrieval operations, especially on large tables. Indexes are particularly useful for columns that are frequently searched, sorted, or used in `JOIN` operations, such as primary keys, foreign keys, or fields in `WHERE` clauses [2]. 

Here are some specific scenarios where you might use a database index:
- **Frequent Searches**: If you often search for data using specific columns, an index on those columns can significantly speed up the search process [2].
- **Sorting and Aggregation**: Indexes can improve the performance of operations that involve sorting (`ORDER BY`) or aggregation (`GROUP BY`) [2].
- **Join Operations**: Indexes on foreign keys can speed up `JOIN` operations by quickly locating the matching rows in the related table [2].
- **Covering Indexes**: For queries that retrieve a small subset of columns, a covering index that includes all the required columns can eliminate the need to access the main table, further improving query performance [4].

In summary, database indexes are a powerful tool for optimizing query performance, but they should be used judiciously to balance the benefits of faster data retrieval against the costs of additional storage and maintenance overhead [1][2][4].


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

First token 0.8 s, total 2.7 s, 1 model step(s).

## Searches

None.

## Answer

A database index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional writes and storage space to maintain the index data structure. 

Indexes are used to quickly locate data without having to search every row in a database table every time a database table is accessed. Indexes can be created using one or more columns of a database table, providing the basis for both rapid random lookups and efficient access of ordered records.

Here are the main reasons to use a database index:
1. **Speed up queries**: Indexes significantly speed up the execution of queries that filter, sort, or join data based on the indexed columns.
2. **Enhance performance**: By reducing the amount of data that needs to be scanned, indexes can greatly improve the performance of database operations.
3. **Optimize data retrieval**: Indexes allow the database engine to quickly locate the rows that match a specific condition, reducing the need for full table scans.

However, it's important to note that while indexes can improve read performance, they can also slow down write operations (INSERT, UPDATE, DELETE) because the index needs to be updated whenever data is modified. Therefore, it's crucial to carefully consider the trade-offs and choose the appropriate columns to index based on the specific query patterns and usage of the database.


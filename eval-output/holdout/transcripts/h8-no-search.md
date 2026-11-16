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

First token 3.3 s, answer starts 3.3 s, total 6.4 s, 1 model step(s).

## Searches

None.

## Answer

A left join and an inner join are two types of joins used in SQL to combine rows from two or more tables based on a related column between them.

- **Left Join**: A left join returns all the rows from the left table (Table A) and the matched rows from the right table (Table B). If there is no match, the result is NULL on the side of the right table. 

- **Inner Join**: An inner join returns only the rows that have matching values in both tables. If there is no match, the row is not included in the result set.

Here's a simple example to illustrate the difference:

Suppose we have two tables, `TableA` and `TableB`:

`TableA`:
```
ID | Name
---|-----
 1 | John
 2 | Jane
 3 | Doe
```

`TableB`:
```
ID | Age
---|-----
 1 | 25
 2 | 30
```

- **Left Join** of `TableA` and `TableB` on `ID`:
```
ID | Name | Age
---|------|-----
 1 | John | 25
 2 | Jane | 30
 3 | Doe  | NULL
```

- **Inner Join** of `TableA` and `TableB` on `ID`:
```
ID | Name | Age
---|------|-----
 1 | John | 25
 2 | Jane | 30
```

In summary, a left join includes all rows from the left table and matching rows from the right table, while an inner join includes only the rows that have matching values in both tables.


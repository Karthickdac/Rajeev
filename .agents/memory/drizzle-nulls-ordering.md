---
name: Drizzle NULLS LAST ordering
description: How to order by a nullable column with NULLS LAST in this Drizzle setup
---

Wrapping a raw NULLS LAST fragment inside the `asc()` helper produces invalid
Postgres SQL: `order by "col" NULLS LAST asc` → `syntax error at or near "asc"`.

**Rule:** put the whole direction + nulls clause in one raw fragment instead:
`.orderBy(sql\`${table.col} asc nulls last\`, desc(table.other))`.

**Why:** `asc()`/`desc()` append the direction keyword *after* whatever you pass,
so any trailing `NULLS LAST` ends up before `asc`, which Postgres rejects.

**How to apply:** any list endpoint that sorts by a nullable timestamp/column
(e.g. tasks by due date) must use the raw-sql form, not `asc(sql\`... NULLS LAST\`)`.

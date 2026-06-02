---
name: Seed file is bilingual
description: Why bulk text edits on the DB seed file are dangerous
---

`lib/db/src/seed.ts` stores bilingual content as twin columns (`title`/`titleTa`,
`content`/`contentTa`, `description`/`descriptionTa`, etc.) across many tables
(news, events, activities, leader config…).

**Rule:** never run a global `sed`/regex delete (e.g. `sed -i '/titleTa:/d'`) on
this file. It will strip Tamil seed data from every table, not just the block you
intended.

**Why:** a single global delete silently removed 17 `titleTa` Tamil lines across
unrelated tables while trying to clean one block; only caught in code review.

**How to apply:** scope edits to the specific block using the edit tool with
surrounding context, or anchor the sed to a line range. Default language is Tamil,
so missing `*Ta` fields is a visible product regression.

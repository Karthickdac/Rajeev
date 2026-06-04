---
name: drizzle-kit generate fails with absolute out path
description: Why `pnpm --filter @workspace/db run generate` errors on snapshot, and the working command.
---

`pnpm --filter @workspace/db run generate` (and `migrate`) can fail with
`ENOENT ... open './/home/runner/workspace/lib/db/migrations/meta/0000_snapshot.json'`
(note the doubled `.//` + absolute path).

**Why:** `lib/db/drizzle.config.ts` sets `out: path.join(__dirname, "./migrations")` —
an absolute path. drizzle-kit 0.31.9 string-prepends `./` when locating the snapshot,
producing a relative `.//<abs>` that resolves under cwd and does not exist.

**How to apply:** to generate a migration, run from inside `lib/db` with an explicit
relative out, bypassing the config's absolute path:
`cd lib/db && npx drizzle-kit generate --dialect postgresql --schema ./src/schema/index.ts --out ./migrations`
For dev DB sync use the workspace script (reads DATABASE_URL via the config):
`pnpm --filter @workspace/db run push --force`. Running `drizzle-kit push` directly
without `--config` fails with "connection url required" because dbCredentials live in the config.

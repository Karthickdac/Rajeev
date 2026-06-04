// ─────────────────────────────────────────────────────────────
// Baseline an EXISTING (already-populated) database so that
// versioned migrations can take over safely.
//
// Background: before versioned migrations existed, the schema was
// applied with `drizzle-kit push`. Those databases already have all
// the tables but no `drizzle.__drizzle_migrations` history, so a plain
// `drizzle-kit migrate` would try to re-CREATE existing tables and fail.
//
// This script marks the FIRST migration (0000, which captures the
// current schema) as already-applied — without running its SQL — so
// that `drizzle-kit migrate` skips it and only applies any newer
// migrations. It is idempotent and safe to run on every deploy:
//   • Fresh DB (no core tables)        → does nothing; migrate creates all.
//   • Already-tracked DB (has history) → does nothing; migrate continues.
//   • Legacy push'd DB (tables, no log)→ inserts the 0000 baseline record.
// ─────────────────────────────────────────────────────────────
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
// A table that has always existed — used to detect a pre-existing schema.
const CORE_TABLE = "users";

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set; cannot baseline.");
  process.exit(1);
}

const journalPath = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
if (!fs.existsSync(journalPath)) {
  console.log("• No migrations journal found; nothing to baseline.");
  process.exit(0);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const first = journal.entries?.find((e) => e.idx === 0);
if (!first) {
  console.log("• No first migration in journal; nothing to baseline.");
  process.exit(0);
}

const sqlPath = path.join(MIGRATIONS_DIR, `${first.tag}.sql`);
const sql = fs.readFileSync(sqlPath, "utf8");
// Hash must match drizzle's migrator: sha256 of the raw .sql file content.
const hash = crypto.createHash("sha256").update(sql).digest("hex");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  const tracked = await client.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') AS t",
  );
  if (tracked.rows[0].t) {
    const count = await client.query(
      'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations',
    );
    if (count.rows[0].n > 0) {
      console.log("• Migration history already present; no baseline needed.");
      process.exit(0);
    }
  }

  const core = await client.query("SELECT to_regclass($1) AS t", [
    `public.${CORE_TABLE}`,
  ]);
  if (!core.rows[0].t) {
    console.log(
      `• Fresh database (no "${CORE_TABLE}" table); migrate will create everything.`,
    );
    process.exit(0);
  }

  // Existing populated DB with no migration history → baseline migration 0000.
  await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await client.query(
    "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
  );
  await client.query(
    'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
    [hash, first.when],
  );
  console.log(
    `✓ Baselined existing database at migration "${first.tag}" — its SQL was NOT re-run.`,
  );
} catch (err) {
  console.error("✗ Baseline failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}

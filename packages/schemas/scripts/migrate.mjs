#!/usr/bin/env node
// Minimal, dependency-light migration runner. Applies sql/*.sql in order,
// recording each in schema_migrations. Idempotent.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, "..", "sql");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: DATABASE_URL not set. Copy .env.example to .env first.");
  process.exit(1);
}

let pg;
try {
  pg = await import("pg");
} catch {
  console.error("FAIL: 'pg' not installed. Run: pnpm add -w pg");
  process.exit(1);
}
const { Client } = pg.default ?? pg;

const client = new Client({ connectionString: url });
await client.connect();
await client.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
);

const files = (await readdir(sqlDir)).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const { rows } = await client.query("SELECT 1 FROM schema_migrations WHERE version=$1", [f]);
  if (rows.length) {
    console.log(`skip  ${f} (already applied)`);
    continue;
  }
  const sql = await readFile(join(sqlDir, f), "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [f]);
    await client.query("COMMIT");
    console.log(`apply ${f} ✓`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`FAIL  ${f}:`, e.message);
    process.exit(1);
  }
}
await client.end();
console.log("migrations complete");

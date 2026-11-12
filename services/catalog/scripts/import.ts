/**
 * Catalogue import CLI (Phase 6).
 *
 * Usage:
 *   tsx services/catalog/scripts/import.ts \
 *     --merchant <slug> --name "<Merchant Name>" --file <feed.csv|json> \
 *     [--format csv|json] [--integration csv|json|api|shopify|woocommerce] [--prune]
 *
 * Needs DATABASE_URL and the migrations applied. Idempotent per (merchant, source_id).
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import pg from "pg";
import { parseFeed, validateAndNormalize } from "../src/importer";
import { importToDb, markMissingDeleted } from "../src/db";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--")) return process.argv[i + 1];
  return process.argv.includes(`--${name}`) ? "true" : fallback;
}

async function main() {
  const file = arg("file");
  const slug = arg("merchant");
  const name = arg("name") ?? slug;
  const integration = (arg("integration") ?? "csv") as any;
  const prune = arg("prune") === "true";
  if (!file || !slug) {
    console.error("usage: --merchant <slug> --name <name> --file <path> [--format csv|json] [--prune]");
    process.exit(1);
  }
  const format = (arg("format") ?? (extname(file).toLowerCase() === ".json" ? "json" : "csv")) as "csv" | "json";
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("FAIL: DATABASE_URL not set"); process.exit(1); }

  const text = readFileSync(file, "utf8");
  const rows = parseFeed(text, format);
  const { products, errors, duplicates, total } = validateAndNormalize(rows, slug);

  console.log(`feed: ${total} rows -> ${products.length} valid, ${errors.length} errors, ${duplicates} duplicates`);
  for (const e of errors.slice(0, 20)) console.log(`  ✗ row ${e.row} ${e.source_id ?? ""}: ${e.reason}`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const summary = await importToDb(client, { slug, name: name!, integration }, products, errors, format + ":" + file);
  let pruned = 0;
  if (prune) pruned = await markMissingDeleted(client, summary.merchant_id, products.map((p) => p.source_id));
  await client.end();

  console.log(`\nimport ${summary.import_id}: +${summary.inserted} new, ~${summary.updated} updated, ${summary.errors} errors${prune ? `, ${pruned} pruned` : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

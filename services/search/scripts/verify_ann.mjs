#!/usr/bin/env node
// Verify the pgvector HNSW ANN path end-to-end against the loaded catalogue.
// Uses product s1's stored embedding as the query (expect s1 nearest, then peers).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { embeddings } = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "seed-embeddings.json"), "utf8"),
);
const url = process.env.DATABASE_URL;
if (!url) { console.error("FAIL: DATABASE_URL not set"); process.exit(1); }

const q = embeddings["s1"]; // Red A-line Midi Dress
const vec = `[${q.join(",")}]`;

const pg = await import("pg");
const { Client } = pg.default ?? pg;
const c = new Client({ connectionString: url });
await c.connect();

const count = await c.query("SELECT count(*)::int n FROM product_embedding");
console.log("embeddings in DB:", count.rows[0].n);

console.log("\n-- ANN, category=dress (HNSW cosine) --");
const dres = await c.query(
  `SELECT p.attributes->>'title' AS title, p.attributes->>'color' AS color,
          round((1 - (e.embedding <=> $1::vector))::numeric, 3) AS sim
   FROM product_embedding e JOIN product p ON p.id=e.product_id
   WHERE p.category='dress'
   ORDER BY e.embedding <=> $1::vector LIMIT 5`, [vec]);
for (const r of dres.rows) console.log(`  sim=${r.sim}  ${r.title} (${r.color})`);

console.log("\n-- ANN, all categories top 6 --");
const all = await c.query(
  `SELECT p.category, p.attributes->>'title' AS title,
          round((1 - (e.embedding <=> $1::vector))::numeric, 3) AS sim
   FROM product_embedding e JOIN product p ON p.id=e.product_id
   ORDER BY e.embedding <=> $1::vector LIMIT 6`, [vec]);
for (const r of all.rows) console.log(`  sim=${r.sim}  [${r.category}] ${r.title}`);

const explain = await c.query(
  `EXPLAIN SELECT p.id FROM product_embedding e JOIN product p ON p.id=e.product_id
   ORDER BY e.embedding <=> $1::vector LIMIT 5`, [vec]);
console.log("\n-- query plan (expect HNSW index scan) --");
console.log(explain.rows.map((r) => "  " + Object.values(r)[0]).join("\n"));

await c.end();

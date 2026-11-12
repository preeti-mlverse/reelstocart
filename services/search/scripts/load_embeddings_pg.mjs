#!/usr/bin/env node
// Load the seed catalogue + FashionCLIP embeddings into Postgres/pgvector so the
// ANN retrieval path (product_embedding HNSW) can be exercised.
// Prereq: infra up, migrations applied (incl. 0002_embedding_dim), `pnpm add -w pg`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const url = process.env.DATABASE_URL;
if (!url) { console.error("FAIL: DATABASE_URL not set"); process.exit(1); }

const { products } = JSON.parse(readFileSync(join(dataDir, "seed-catalogue.json"), "utf8"));
const embPath = join(dataDir, "seed-embeddings.json");
const { model, dim, embeddings } = JSON.parse(readFileSync(embPath, "utf8"));

let pg;
try { pg = await import("pg"); } catch { console.error("FAIL: run `pnpm add -w pg`"); process.exit(1); }
const { Client } = pg.default ?? pg;
const c = new Client({ connectionString: url });
await c.connect();

const m = await c.query(
  `INSERT INTO merchant(name, slug, integration) VALUES('Sample Catalogue','sample-catalogue','manual')
   ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`
);
const merchantId = m.rows[0].id;

let n = 0;
for (const p of products) {
  const pr = await c.query(
    `INSERT INTO product(merchant_id, source_id, title, category, product_url, source_attribution, color, pattern, fit, attributes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (merchant_id, source_id) DO UPDATE SET title=EXCLUDED.title RETURNING id`,
    [merchantId, p.id, p.title, p.category, p.product_url, p.source_attribution,
     p.color ?? null, p.pattern ?? null, p.silhouette ?? null, JSON.stringify(p)]
  );
  const productId = pr.rows[0].id;
  await c.query(`INSERT INTO product_image(product_id, url, role) VALUES($1,$2,'front')`, [productId, p.image])
    .catch(() => {});
  const vec = embeddings[p.id];
  if (vec) {
    await c.query(
      `INSERT INTO product_embedding(product_id, model_id, model_version, image_role, dim, embedding)
       VALUES($1,$2,'v1','front',$3,$4::vector)`,
      [productId, model, dim, `[${vec.join(",")}]`]
    );
    n++;
  }
}
console.log(`loaded ${products.length} products, ${n} embeddings (model=${model}, dim=${dim})`);
console.log("ANN query example:");
console.log(`  SELECT p.title FROM product_embedding e JOIN product p ON p.id=e.product_id
  ORDER BY e.embedding <=> $1::vector LIMIT 10;`);
await c.end();

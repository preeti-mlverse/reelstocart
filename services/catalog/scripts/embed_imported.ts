/**
 * Embed imported products that lack a visual embedding (Phase 6 -> 7 bridge):
 * fetch each product image (SSRF-guarded), embed via the vision service, and store
 * in product_embedding so imported products become searchable via pgvector ANN.
 *
 * Usage: tsx services/catalog/scripts/embed_imported.ts   (needs DATABASE_URL + vision up)
 */
import pg from "pg";
import { validateRemoteUrl } from "@rtc/shared";

const VISION = process.env.VISION_SERVICE_URL || "http://127.0.0.1:8000";
const DB = process.env.DATABASE_URL;
if (!DB) { console.error("FAIL: DATABASE_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: DB });
await client.connect();

const { rows } = await client.query(`
  SELECT p.id, p.title,
         (SELECT url FROM product_image WHERE product_id = p.id ORDER BY position LIMIT 1) AS image
  FROM product p
  WHERE p.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM product_embedding e WHERE e.product_id = p.id)
`);
console.log(`${rows.length} products need embeddings`);

let done = 0;
for (const r of rows as Array<{ id: string; title: string; image: string }>) {
  const v = validateRemoteUrl(r.image, { schemes: ["https"], allowLocalhost: false });
  if (!v.ok) { console.log(`  skip ${r.title}: ${v.reason}`); continue; }
  try {
    const imgRes = await fetch(v.normalized!);
    if (!imgRes.ok) { console.log(`  skip ${r.title}: image HTTP ${imgRes.status}`); continue; }
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const form = new FormData();
    form.append("file", new Blob([buf]), "img");
    const er = await fetch(`${VISION}/v1/embed/image`, { method: "POST", body: form });
    if (!er.ok) { console.log(`  embed fail ${r.title}: HTTP ${er.status}`); continue; }
    const { embedding, dim, model } = (await er.json()) as { embedding: number[]; dim: number; model: string };
    await client.query(
      `INSERT INTO product_embedding(product_id, model_id, model_version, image_role, dim, embedding)
       VALUES($1,$2,'v1','front',$3,$4::vector)`,
      [r.id, model, dim, `[${embedding.join(",")}]`],
    );
    done++;
  } catch (e) {
    console.log(`  error ${r.title}: ${e instanceof Error ? e.message : e}`);
  }
}
await client.end();
console.log(`embedded ${done} products`);

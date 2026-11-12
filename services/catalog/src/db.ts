/**
 * DB upsert for imported products (Phase 6). Idempotent per (merchant, source_id):
 * re-running a feed updates rather than duplicates. Records a catalogue_import row
 * + per-row errors, and appends inventory/price history.
 */
import type { NormalizedProduct, RowError } from "./importer";

export interface PgClientLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface MerchantInput {
  slug: string;
  name: string;
  integration?: "manual" | "csv" | "json" | "api" | "shopify" | "woocommerce";
}

export interface ImportSummary {
  import_id: string;
  merchant_id: string;
  inserted: number;
  updated: number;
  errors: number;
}

export async function ensureMerchant(db: PgClientLike, m: MerchantInput): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO merchant(name, slug, integration) VALUES($1,$2,$3)
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, integration=EXCLUDED.integration
     RETURNING id`,
    [m.name, m.slug, m.integration ?? "manual"],
  );
  return rows[0]!.id as string;
}

export async function importToDb(
  db: PgClientLike,
  merchant: MerchantInput,
  products: NormalizedProduct[],
  errors: RowError[],
  source: string,
): Promise<ImportSummary> {
  const merchantId = await ensureMerchant(db, merchant);

  const imp = await db.query(
    `INSERT INTO catalogue_import(merchant_id, source, status, rows_total)
     VALUES($1,$2,'running',$3) RETURNING id`,
    [merchantId, source, products.length + errors.length],
  );
  const importId = imp.rows[0]!.id as string;

  let inserted = 0;
  let updated = 0;

  for (const p of products) {
    const pr = await db.query(
      `INSERT INTO product(merchant_id, source_id, title, category, description, product_url,
                           source_attribution, color, pattern, fabric, fit, attributes, verified_at, deleted_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), NULL)
       ON CONFLICT (merchant_id, source_id) DO UPDATE SET
         title=EXCLUDED.title, category=EXCLUDED.category, description=EXCLUDED.description,
         product_url=EXCLUDED.product_url, color=EXCLUDED.color, pattern=EXCLUDED.pattern,
         fabric=EXCLUDED.fabric, fit=EXCLUDED.fit, attributes=EXCLUDED.attributes,
         verified_at=now(), deleted_at=NULL
       RETURNING id, (xmax = 0) AS inserted`,
      [merchantId, p.source_id, p.title, p.category, p.description ?? null, p.product_url,
       p.source_attribution, p.color ?? null, p.pattern ?? null, p.fabric ?? null, p.silhouette ?? null,
       JSON.stringify({ ...p, merchant: merchant.slug, is_sample: false })],
    );
    const productId = pr.rows[0]!.id as string;
    if (pr.rows[0]!.inserted) inserted++; else updated++;

    // images: replace set
    await db.query(`DELETE FROM product_image WHERE product_id=$1`, [productId]);
    await db.query(`INSERT INTO product_image(product_id, url, role, position) VALUES($1,$2,'front',0)`,
      [productId, p.image]);

    // variants per size (sku = source_id-size), with price; append inventory + price history
    const sizes = p.sizes.length ? p.sizes : ["OS"];
    for (const size of sizes) {
      const sku = `${p.source_id}-${size}`;
      const v = await db.query(
        `INSERT INTO product_variant(product_id, sku, size, color, price_inr, mrp_inr)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT (product_id, sku) DO UPDATE SET price_inr=EXCLUDED.price_inr, mrp_inr=EXCLUDED.mrp_inr
         RETURNING id`,
        [productId, sku, size, p.color ?? null, p.price_inr, p.mrp_inr],
      );
      const variantId = v.rows[0]!.id as string;
      await db.query(
        `INSERT INTO inventory_snapshot(variant_id, availability) VALUES($1,$2)`,
        [variantId, p.availability],
      );
      if (p.price_inr != null) {
        await db.query(`INSERT INTO price_history(variant_id, price_inr) VALUES($1,$2)`, [variantId, p.price_inr]);
      }
    }
  }

  for (const e of errors) {
    await db.query(
      `INSERT INTO catalogue_import_error(import_id, row_ref, message) VALUES($1,$2,$3)`,
      [importId, e.source_id ?? `row ${e.row}`, e.reason],
    );
  }

  await db.query(
    `UPDATE catalogue_import SET status='complete', rows_ok=$2, rows_error=$3, finished_at=now() WHERE id=$1`,
    [importId, products.length, errors.length],
  );

  return { import_id: importId, merchant_id: merchantId, inserted, updated, errors: errors.length };
}

/**
 * Soft-delete products of a merchant that were NOT in the latest feed (Phase 6:
 * deleted-product handling). Pass the source_ids present in the feed.
 */
export async function markMissingDeleted(
  db: PgClientLike, merchantId: string, presentSourceIds: string[],
): Promise<number> {
  const { rows } = await db.query(
    `UPDATE product SET deleted_at=now()
     WHERE merchant_id=$1 AND deleted_at IS NULL AND NOT (source_id = ANY($2::text[]))
     RETURNING id`,
    [merchantId, presentSourceIds],
  );
  return rows.length;
}

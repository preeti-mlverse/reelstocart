/**
 * Server-only Postgres access for pages (browse, product detail, sitemap, admin)
 * and for event logging. Every read degrades to an empty result if the DB is
 * unreachable, so a DB outage never takes the marketing/SEO pages down.
 */
import type { Pool as PgPool } from "pg";

type Row = Record<string, unknown>;
const g = globalThis as unknown as { __rtcPool?: PgPool };

export const dbEnabled = () => !!process.env.DATABASE_URL;

export async function pool(): Promise<PgPool> {
  if (!g.__rtcPool) {
    const pg = await import("pg");
    const { Pool } = (pg as any).default ?? pg;
    g.__rtcPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 }) as PgPool;
  }
  return g.__rtcPool!;
}

export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = await pool();
  const r = await p.query(sql, params);
  return r.rows as T[];
}

async function safe<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  if (!dbEnabled()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error(`[db] ${label} failed:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

export interface ProductRow {
  id: string;
  title: string;
  category: string;
  brand: string | null;
  merchant: string;
  image: string;
  product_url: string;
  price_inr: number | null;
  mrp_inr: number | null;
  availability: "in_stock" | "out_of_stock" | "unverified";
  color: string | null;
  pattern: string | null;
  silhouette: string | null;
  neckline: string | null;
  sleeve_type: string | null;
  garment_length: string | null;
  sizes: string[];
  description: string | null;
  is_sample: boolean;
  updated_at: string;
}

const PRODUCT_COLS = `p.id::text AS id, p.title, p.category, p.description AS p_desc, p.attributes AS a,
  m.name AS merchant_name, m.slug AS merchant_slug,
  COALESCE(p.verified_at, p.created_at) AS updated_at`;

function toProduct(r: Row): ProductRow {
  const a = (r.a ?? {}) as Record<string, any>;
  const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  const str = (v: unknown) => (typeof v === "string" && v && v !== "unknown" ? v : null);
  return {
    id: String(r.id),
    title: String(r.title),
    category: String(r.category),
    brand: str(a.brand),
    merchant: str(a.merchant) ?? String(r.merchant_name ?? ""),
    image: String(a.image ?? ""),
    product_url: String(a.product_url ?? ""),
    price_inr: num(a.price_inr),
    mrp_inr: num(a.mrp_inr),
    availability: (["in_stock", "out_of_stock"].includes(a.availability) ? a.availability : "unverified"),
    color: str(a.color),
    pattern: str(a.pattern),
    silhouette: str(a.silhouette),
    neckline: str(a.neckline),
    sleeve_type: str(a.sleeve_type),
    garment_length: str(a.garment_length),
    sizes: Array.isArray(a.sizes) ? a.sizes.map(String) : [],
    description: str(r.p_desc) ?? str(a.description),
    is_sample: a.is_sample === true,
    updated_at: new Date(r.updated_at as string).toISOString(),
  };
}

export const listProducts = (category: string | null, limit: number, offset: number) =>
  safe(async () => {
    const params: unknown[] = [limit, offset];
    let where = "p.deleted_at IS NULL";
    if (category) { params.push(category); where += ` AND p.category = $${params.length}`; }
    const rows = await q(
      `SELECT ${PRODUCT_COLS}, count(*) OVER() AS total
         FROM product p JOIN merchant m ON m.id = p.merchant_id
        WHERE ${where}
        ORDER BY (p.attributes->>'is_sample')::boolean NULLS FIRST, p.created_at DESC, p.title
        LIMIT $1 OFFSET $2`,
      params,
    );
    return { items: rows.map(toProduct), total: rows.length ? Number(rows[0].total) : 0 };
  }, { items: [] as ProductRow[], total: 0 }, "listProducts");

export const getProduct = (id: string) =>
  safe(async () => {
    const rows = await q(
      `SELECT ${PRODUCT_COLS} FROM product p JOIN merchant m ON m.id = p.merchant_id
        WHERE p.id = $1::uuid AND p.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? toProduct(rows[0]) : null;
  }, null, "getProduct");

/** Visually similar products via the product's own FashionCLIP embedding (pgvector HNSW). */
export const similarProducts = (id: string, limit = 8) =>
  safe(async () => {
    const rows = await q(
      `WITH src AS (SELECT embedding FROM product_embedding WHERE product_id = $1::uuid LIMIT 1)
       SELECT ${PRODUCT_COLS}
         FROM product_embedding e
         JOIN product p ON p.id = e.product_id
         JOIN merchant m ON m.id = p.merchant_id, src
        WHERE p.id <> $1::uuid AND p.deleted_at IS NULL
        ORDER BY e.embedding <=> src.embedding
        LIMIT $2`,
      [id, limit],
    );
    return rows.map(toProduct);
  }, [] as ProductRow[], "similarProducts");

export const categoryCounts = () =>
  safe(async () => {
    const rows = await q<{ category: string; n: string; image: string | null }>(
      `SELECT category, count(*) AS n,
              (array_agg(attributes->>'image' ORDER BY (attributes->>'is_sample')::boolean NULLS FIRST, created_at DESC))[1] AS image
         FROM product WHERE deleted_at IS NULL GROUP BY category`,
    );
    return Object.fromEntries(rows.map((r) => [r.category, { count: Number(r.n), image: r.image }]));
  }, {} as Record<string, { count: number; image: string | null }>, "categoryCounts");

/** Products eligible for the sitemap: real (non-fixture) and not deleted. */
export const sitemapProducts = () =>
  safe(async () => {
    const rows = await q(
      `SELECT ${PRODUCT_COLS} FROM product p JOIN merchant m ON m.id = p.merchant_id
        WHERE p.deleted_at IS NULL AND COALESCE((p.attributes->>'is_sample')::boolean, false) = false
        ORDER BY p.created_at DESC LIMIT 45000`,
    );
    return rows.map(toProduct);
  }, [] as ProductRow[], "sitemapProducts");

// ---------------------------------------------------------------- events (Phase 11)

export async function logSearchJob(job: {
  kind: "image" | "video";
  cost_usd: number;
  model: string;
  latency_ms: number;
  summary: unknown;
  productIds: string[];
}): Promise<string | null> {
  return safe(async () => {
    const [row] = await q<{ id: string }>(
      `INSERT INTO search_job (input_kind, input_ref, provider, status, result, cost_usd)
       VALUES ('upload', $1, 'upload', 'DONE', $2, $3) RETURNING id::text`,
      [`upload:${job.kind}`, JSON.stringify(job.summary), job.cost_usd],
    );
    await q(
      `INSERT INTO ai_op_cost (job_id, stage, model, cost_usd, latency_ms) VALUES ($1::uuid, $2, $3, $4, $5)`,
      [row.id, job.kind === "video" ? "video" : "detect", job.model, job.cost_usd, Math.round(job.latency_ms)],
    );
    const ids = [...new Set(job.productIds)];
    if (ids.length) {
      await q(
        `INSERT INTO product_event (product_id, job_id, kind)
         SELECT unnest($1::uuid[]), $2::uuid, 'impression'`,
        [ids, row.id],
      );
    }
    return row.id;
  }, null, "logSearchJob");
}

export async function logClick(productId: string, jobId: string | null): Promise<string | null> {
  return safe(async () => {
    const rows = await q<{ url: string }>(
      `WITH ins AS (
         INSERT INTO product_event (product_id, job_id, kind)
         SELECT p.id, $2::uuid, 'click' FROM product p WHERE p.id = $1::uuid AND p.deleted_at IS NULL
         RETURNING product_id)
       SELECT p.product_url AS url FROM product p JOIN ins ON ins.product_id = p.id`,
      [productId, jobId],
    );
    return rows[0]?.url ?? null;
  }, null, "logClick");
}

// ---------------------------------------------------------------- admin (Phase 12)

export const adminStats = () =>
  safe(async () => {
    const [catalogue, byMerchant, imports, importErrors, searches, events, topClicked, cost] = await Promise.all([
      q(`SELECT count(*)::int AS products,
                count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted,
                (SELECT count(*)::int FROM product_embedding) AS embeddings,
                (SELECT count(*)::int FROM merchant) AS merchants
           FROM product`),
      q(`SELECT m.name, m.slug, m.integration, count(p.*)::int AS products,
                count(e.*)::int AS embedded
           FROM merchant m LEFT JOIN product p ON p.merchant_id = m.id AND p.deleted_at IS NULL
           LEFT JOIN product_embedding e ON e.product_id = p.id
          GROUP BY m.id ORDER BY products DESC`),
      q(`SELECT ci.id::text, m.slug, ci.source, ci.status, ci.rows_total, ci.rows_ok, ci.rows_error,
                ci.started_at, ci.finished_at
           FROM catalogue_import ci JOIN merchant m ON m.id = ci.merchant_id
          ORDER BY ci.started_at DESC LIMIT 10`),
      q(`SELECT e.row_ref, e.message, ci.source
           FROM catalogue_import_error e JOIN catalogue_import ci ON ci.id = e.import_id
          ORDER BY ci.started_at DESC LIMIT 15`),
      q(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last_24h,
                count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS last_7d,
                COALESCE(sum(cost_usd), 0)::float AS cost_usd
           FROM search_job`),
      q(`SELECT kind, count(*)::int AS n FROM product_event
          WHERE created_at > now() - interval '30 days' GROUP BY kind`),
      q(`SELECT p.id::text, p.title, p.category, count(*)::int AS clicks
           FROM product_event ev JOIN product p ON p.id = ev.product_id
          WHERE ev.kind = 'click' GROUP BY p.id ORDER BY clicks DESC LIMIT 10`),
      q(`SELECT stage, model, count(*)::int AS calls, COALESCE(sum(cost_usd),0)::float AS cost_usd,
                COALESCE(avg(latency_ms),0)::int AS avg_ms
           FROM ai_op_cost GROUP BY stage, model ORDER BY cost_usd DESC`),
    ]);
    return { catalogue: catalogue[0], byMerchant, imports, importErrors, searches: searches[0], events, topClicked, cost };
  }, null, "adminStats");

export async function dbHealthy(): Promise<boolean> {
  return safe(async () => { await q("SELECT 1"); return true; }, false, "health");
}

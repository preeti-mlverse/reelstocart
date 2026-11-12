/**
 * pgvector-backed visual candidate retrieval (Phase 7). Runs the HNSW ANN query
 * (cosine) with an optional hard category filter, returning candidates with a
 * visual_similarity for the hybrid reranker. The product object is reconstructed
 * from the stored attributes JSON so it matches the SeedProduct shape.
 */
import type { SeedProduct } from "./matcher";

/** Minimal shape of a `pg` client (node-postgres) — avoids a hard dep here. */
export interface PgClientLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface AnnOptions {
  category?: string;
  limit?: number;
}

export interface VisualCandidate {
  product: SeedProduct;
  visual_similarity: number;
}

export async function annSearch(
  db: PgClientLike,
  queryEmbedding: number[],
  opts: AnnOptions = {},
): Promise<VisualCandidate[]> {
  const vec = `[${queryEmbedding.join(",")}]`;
  const params: unknown[] = [vec];
  let where = "WHERE p.deleted_at IS NULL";
  if (opts.category) {
    params.push(opts.category);
    where += ` AND p.category = $${params.length}`;
  }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const sql = `
    SELECT p.attributes AS product,
           1 - (e.embedding <=> $1::vector) AS visual_similarity
    FROM product_embedding e
    JOIN product p ON p.id = e.product_id
    ${where}
    ORDER BY e.embedding <=> $1::vector
    LIMIT ${limit}`;
  const { rows } = await db.query(sql, params);
  return rows.map((r) => ({
    product: r.product as SeedProduct,
    visual_similarity: Number(r.visual_similarity),
  }));
}

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
  /** Several allowed categories (e.g. a top may match a co-ord set). Overrides `category`. */
  categories?: string[];
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
  if (opts.categories?.length) {
    params.push(opts.categories);
    where += ` AND p.category = ANY($${params.length}::text[])`;
  } else if (opts.category) {
    params.push(opts.category);
    where += ` AND p.category = $${params.length}`;
  }
  const limit = Math.max(1, Math.min(opts.limit ?? 100, 500));
  const sql = `
    SELECT p.attributes AS product,
           p.id::text AS db_id,
           1 - (e.embedding <=> $1::vector) AS visual_similarity
    FROM product_embedding e
    JOIN product p ON p.id = e.product_id
    ${where}
    ORDER BY e.embedding <=> $1::vector
    LIMIT ${limit}`;
  const { rows } = await db.query(sql, params);
  return rows.map((r) => ({
    product: { ...(r.product as SeedProduct), db_id: r.db_id as string | undefined },
    visual_similarity: Number(r.visual_similarity),
  }));
}

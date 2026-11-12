/**
 * Hybrid reranking (Phase 7–8): fuse visual embedding similarity with attribute
 * agreement into one score. Two entry points share the same fusion core:
 *  - rerankHybrid:     visual sims computed in-process from an embeddings map.
 *  - rerankWithVisual: visual sims already computed (e.g. by a pgvector ANN query).
 *
 * Still honest: never EXACT_VERIFIED from embeddings alone; hard mismatches cap
 * the bucket.
 */
import type { MatchLabel } from "@rtc/schemas";
import { matchGarment, type SeedProduct, type QueryGarment, type MatchFilters, type ScoredMatch } from "./matcher";

export type EmbeddingMap = Record<string, number[]>;

/** Cosine for L2-normalised vectors = dot product. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

export interface HybridWeights {
  visual: number;
  attribute: number;
}
export const DEFAULT_WEIGHTS: HybridWeights = { visual: 0.5, attribute: 0.5 };

export interface HybridMatch extends ScoredMatch {
  visual_similarity?: number;
}

function labelFor(score: number, hardMismatches: number, hasVisual: boolean): MatchLabel {
  if (hardMismatches > 0) return score >= 0.5 ? "STYLE_ALTERNATIVE" : "NO_RELIABLE_MATCH";
  if (score >= (hasVisual ? 0.85 : 0.82)) return "VERY_CLOSE"; // EXACT_VERIFIED needs verified identity
  if (score >= 0.62) return "SIMILAR";
  if (score >= 0.4) return "STYLE_ALTERNATIVE";
  return "NO_RELIABLE_MATCH";
}

/** Shared fusion core: combine attribute matches with per-product visual sims. */
function fuse(
  attrMatches: ScoredMatch[],
  visById: Record<string, number | undefined>,
  weights: HybridWeights,
  limit: number,
): HybridMatch[] {
  const fused = attrMatches.map<HybridMatch>((m) => {
    const vis = visById[m.product.id];
    const attr = m.attribute_agreement;
    const hard = m.explanation.hard_mismatches.length;

    let score =
      vis != null ? (weights.visual * vis + weights.attribute * attr) / (weights.visual + weights.attribute) : attr;
    score = Math.max(0, score - hard * 0.35);

    const similarities = [...m.explanation.similarities];
    if (vis != null && vis >= 0.75) similarities.unshift(`visual match (${vis.toFixed(2)})`);

    return {
      ...m,
      score: Number(score.toFixed(3)),
      visual_similarity: vis != null ? Number(vis.toFixed(3)) : undefined,
      match_label: labelFor(score, hard, vis != null),
      explanation: { ...m.explanation, similarities },
    };
  });
  return fused.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** In-process hybrid: attribute candidates + cosine over an embeddings map. */
export function rerankHybrid(
  garment: QueryGarment,
  queryEmbedding: number[] | undefined,
  catalogue: SeedProduct[],
  embeddings: EmbeddingMap,
  filters: MatchFilters = {},
  weights: HybridWeights = DEFAULT_WEIGHTS,
  limit = 20,
): HybridMatch[] {
  const candidates = matchGarment(garment, catalogue, filters, catalogue.length);
  const visById: Record<string, number | undefined> = {};
  for (const m of candidates) {
    const pe = embeddings[m.product.id];
    visById[m.product.id] = queryEmbedding && pe ? Math.max(0, cosine(queryEmbedding, pe)) : undefined;
  }
  return fuse(candidates, visById, weights, limit);
}

/** pgvector path: candidates already carry a visual similarity from the ANN query. */
export function rerankWithVisual(
  garment: QueryGarment,
  candidates: Array<{ product: SeedProduct; visual_similarity: number }>,
  filters: MatchFilters = {},
  weights: HybridWeights = DEFAULT_WEIGHTS,
  limit = 20,
): HybridMatch[] {
  const products = candidates.map((c) => c.product);
  const visById: Record<string, number | undefined> = {};
  for (const c of candidates) visById[c.product.id] = Math.max(0, c.visual_similarity);
  const attrMatches = matchGarment(garment, products, filters, products.length);
  return fuse(attrMatches, visById, weights, limit);
}

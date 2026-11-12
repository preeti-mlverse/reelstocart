/**
 * Hybrid reranking (Phase 7–8): fuse visual embedding similarity with attribute
 * agreement into one score. Stage 1 is the attribute matcher (category filter +
 * per-attribute agreement + hard-mismatch flags); stage 2 adds FashionCLIP cosine.
 *
 * Still honest: never EXACT_VERIFIED from embeddings alone, and hard mismatches
 * (wrong category is already filtered; solid colour clash) cap the bucket.
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

function labelFor(score: number, hardMismatches: number, hasVisual: boolean): MatchLabel {
  if (hardMismatches > 0) return score >= 0.5 ? "STYLE_ALTERNATIVE" : "NO_RELIABLE_MATCH";
  // Visual agreement raises confidence, but EXACT_VERIFIED still requires verified identity.
  if (score >= (hasVisual ? 0.85 : 0.82)) return "VERY_CLOSE";
  if (score >= 0.62) return "SIMILAR";
  if (score >= 0.4) return "STYLE_ALTERNATIVE";
  return "NO_RELIABLE_MATCH";
}

export interface HybridMatch extends ScoredMatch {
  visual_similarity?: number;
}

/**
 * @param queryEmbedding visual embedding of the detected garment crop (may be undefined)
 * @param embeddings     product_id -> embedding
 */
export function rerankHybrid(
  garment: QueryGarment,
  queryEmbedding: number[] | undefined,
  catalogue: SeedProduct[],
  embeddings: EmbeddingMap,
  filters: MatchFilters = {},
  weights: HybridWeights = DEFAULT_WEIGHTS,
  limit = 20,
): HybridMatch[] {
  // Stage 1: get the full candidate set (category-filtered) with attribute signals.
  const candidates = matchGarment(garment, catalogue, filters, catalogue.length);

  const fused: HybridMatch[] = candidates.map((m) => {
    const pe = embeddings[m.product.id];
    const hasVisual = !!(queryEmbedding && pe);
    const vis = hasVisual ? Math.max(0, cosine(queryEmbedding!, pe!)) : undefined;
    const attr = m.attribute_agreement;
    const hard = m.explanation.hard_mismatches.length;

    let score: number;
    if (vis != null) {
      const wv = weights.visual, wa = weights.attribute;
      score = (wv * vis + wa * attr) / (wv + wa);
    } else {
      score = attr; // fall back to attribute-only when an embedding is missing
    }
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

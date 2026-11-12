import { describe, it, expect } from "vitest";
import { rerankHybrid, cosine, type EmbeddingMap } from "../src/hybrid";
import type { SeedProduct, QueryGarment } from "../src/matcher";

const attr = (v: unknown) => ({ value: v, confidence: 0.9 });

const unit = (v: number[]) => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};

// Two red dresses identical on attributes; only the embedding differs.
const cat: SeedProduct[] = [
  { id: "A", merchant: "M", title: "Dress A", category: "dress", product_url: "https://e.com/a",
    image: "/a.jpg", color: "red", pattern: "solid", silhouette: "a_line", price_inr: 1000,
    sizes: ["M"], availability: "in_stock", source_attribution: "fixture" },
  { id: "B", merchant: "M", title: "Dress B", category: "dress", product_url: "https://e.com/b",
    image: "/b.jpg", color: "red", pattern: "solid", silhouette: "a_line", price_inr: 1000,
    sizes: ["M"], availability: "in_stock", source_attribution: "fixture" },
];

const embeddings: EmbeddingMap = {
  A: unit([1, 0, 0, 0]),
  B: unit([0, 1, 0, 0]),
};

const query: QueryGarment = {
  category: "dress",
  attributes: { primary_color: attr("red"), pattern: attr("solid"), silhouette: attr("a_line") },
};

describe("cosine", () => {
  it("is 1 for identical unit vectors, 0 for orthogonal", () => {
    expect(cosine(unit([1, 1]), unit([1, 1]))).toBeCloseTo(1, 5);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
});

describe("rerankHybrid", () => {
  it("breaks attribute ties by visual similarity", () => {
    const qemb = unit([0.9, 0.1, 0, 0]); // closer to A
    const res = rerankHybrid(query, qemb, cat, embeddings);
    expect(res[0]!.product.id).toBe("A");
    expect(res[0]!.visual_similarity!).toBeGreaterThan(res[1]!.visual_similarity!);
  });

  it("flips ranking when the query is visually closer to B", () => {
    const qemb = unit([0.1, 0.9, 0, 0]);
    const res = rerankHybrid(query, qemb, cat, embeddings);
    expect(res[0]!.product.id).toBe("B");
  });

  it("falls back to attribute-only when no query embedding", () => {
    const res = rerankHybrid(query, undefined, cat, embeddings);
    expect(res).toHaveLength(2);
    expect(res.every((r) => r.visual_similarity === undefined)).toBe(true);
  });

  it("never returns EXACT_VERIFIED from embeddings", () => {
    const qemb = unit([1, 0, 0, 0]);
    const res = rerankHybrid(query, qemb, cat, embeddings);
    expect(res.every((r) => r.match_label !== "EXACT_VERIFIED")).toBe(true);
  });

  it("adds a visual-match note when similarity is high", () => {
    const qemb = unit([1, 0, 0, 0]);
    const res = rerankHybrid(query, qemb, cat, embeddings);
    expect(res[0]!.explanation.similarities.join(" ")).toMatch(/visual match/);
  });
});

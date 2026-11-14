import { describe, it, expect } from "vitest";
import { rerankWithVisual, NEAR_DUPLICATE_SIM } from "../src/hybrid";
import { colorClose, compatibleCategories, matchGarment, type SeedProduct, type QueryGarment } from "../src/matcher";
import { composeOutfit } from "../src/composer";

const attr = (v: unknown) => ({ value: v, confidence: 0.9 });
const prod = (o: Partial<SeedProduct> & { id: string; category: string }): SeedProduct => ({
  merchant: "M", title: o.id, product_url: `https://e.com/${o.id}`, image: "/x.jpg",
  availability: "in_stock", source_attribution: "fixture", ...o,
});

describe("colour families", () => {
  it("treats merchant fashion names as close to basic VLM colours", () => {
    expect(colorClose("brown", "clay")).toBe(true);
    expect(colorClose("brown", "saddle brown")).toBe(true);
    expect(colorClose("green", "sage")).toBe(true);
    expect(colorClose("blue", "navy")).toBe(true);
  });
  it("still separates genuinely different colours", () => {
    expect(colorClose("green", "red")).toBe(false);
    expect(colorClose("black", "white")).toBe(false);
  });
});

describe("co-ord compatibility", () => {
  it("lets a detected top or trousers match a co_ord_set listing, discounted and explained", () => {
    expect(compatibleCategories("top")).toContain("co_ord_set");
    expect(compatibleCategories("dress")).toEqual(["dress"]);
    const q: QueryGarment = { category: "trousers", attributes: { primary_color: attr("brown") } };
    const out = matchGarment(q, [
      prod({ id: "set", category: "co_ord_set", color: "brown" }),
      prod({ id: "pants", category: "trousers", color: "brown" }),
      prod({ id: "dress", category: "dress", color: "brown" }),
    ]);
    expect(out.map((m) => m.product.id)).toEqual(["pants", "set"]);
    expect(out[1]!.explanation.differences).toContain("sold as co ord set");
    expect(out[1]!.score).toBeLessThan(out[0]!.score);
  });
});

describe("near-duplicate calibration", () => {
  const q: QueryGarment = { category: "dress", attributes: { primary_color: attr("brown"), pattern: attr("solid") } };

  it("labels a visual near-duplicate VERY_CLOSE even when the feed has few attributes", () => {
    const [m] = rerankWithVisual(q, [{ product: prod({ id: "A", category: "dress", color: "clay" }), visual_similarity: 0.94 }]);
    expect(NEAR_DUPLICATE_SIM).toBeGreaterThan(0.85);
    expect(m!.match_label).toBe("VERY_CLOSE");
  });

  it("does not let one sparse-attribute disagreement sink a strong visual match", () => {
    const [m] = rerankWithVisual(q, [{ product: prod({ id: "A", category: "dress", color: "orange" }), visual_similarity: 0.88 }]);
    // only colour comparable (coverage 0.28), and it disagrees -> attribute weight shrinks
    expect(m!.score).toBeGreaterThan(0.6);
  });

  it("never upgrades a hard mismatch, however similar it looks", () => {
    const solid: QueryGarment = { category: "dress", attributes: { primary_color: attr("red"), pattern: attr("solid") } };
    const [m] = rerankWithVisual(solid, [{
      product: prod({ id: "A", category: "dress", color: "green", pattern: "solid" }), visual_similarity: 0.97,
    }]);
    expect(m!.match_label).not.toBe("VERY_CLOSE");
    expect(m!.explanation.hard_mismatches.length).toBe(1);
  });
});

describe("composeOutfit (Phase 9)", () => {
  const sm = (id: string, price: number, score: number) => ({
    product: prod({ id, category: "x", price_inr: price }), score, attribute_agreement: score,
    match_label: "SIMILAR" as const, explanation: { similarities: [], differences: [], hard_mismatches: [] }, stale_stock: false,
  });
  it("picks the best combination that fits the budget and reports missing slots honestly", () => {
    const out = composeOutfit([
      { slot: "top", essential: false, options: [sm("t-exp", 4000, 0.9), sm("t-cheap", 1000, 0.7)] },
      { slot: "bottom", essential: false, options: [sm("b-exp", 5000, 0.95)] },
    ], 3000);
    expect(out.items.map((i) => i.match.product.id)).toEqual(["t-cheap"]);
    expect(out.total_inr).toBe(1000);
    expect(out.missing_slots).toEqual(["bottom"]);
    expect(out.within_budget).toBe(true);
  });

  it("charges a co-ord set once when it fills both the top and bottom slot", () => {
    const set = sm("coord", 6000, 0.9);
    const out = composeOutfit([
      { slot: "top", essential: false, options: [set] },
      { slot: "bottom", essential: false, options: [set] },
    ], 7000);
    expect(out.items).toHaveLength(2);
    expect(out.total_inr).toBe(6000);
    expect(out.coverage).toBe(1);
  });
});

describe("evidence floor", () => {
  it("does not present a weak visual match with thin, disagreeing attributes as a match", () => {
    const q: QueryGarment = { category: "jacket", attributes: { primary_color: attr("green"), pattern: attr("solid") } };
    const [m] = rerankWithVisual(q, [{ product: prod({ id: "navy", category: "jacket", color: "navy" }), visual_similarity: 0.59 }]);
    expect(m!.match_label).toBe("NO_RELIABLE_MATCH");
  });
});

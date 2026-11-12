import { describe, it, expect } from "vitest";
import { matchGarment, type QueryGarment } from "../src/matcher.js";
import { composeOutfit, type SlotShortlist } from "../src/composer.js";
import { loadSeedCatalogue } from "../src/index.js";

const cat = loadSeedCatalogue();

const attr = (v: unknown) => ({ value: v, confidence: 0.9 });

// The red A-line knee-length sleeveless dress our Gemini probe returned.
const redDress: QueryGarment = {
  category: "dress",
  attributes: {
    primary_color: attr("red"),
    pattern: attr("solid"),
    neckline: attr("boat"),
    sleeve_type: attr("sleeveless"),
    silhouette: attr("a_line"),
    garment_length: attr("knee"),
  },
};

describe("matchGarment", () => {
  it("ranks the exact-style red A-line dress top", () => {
    const res = matchGarment(redDress, cat);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0]!.product.id).toBe("s1"); // Red A-line Midi Dress
    expect(["VERY_CLOSE", "SIMILAR"]).toContain(res[0]!.match_label);
    expect(res[0]!.explanation.similarities.join(" ")).toMatch(/colour|red/i);
  });

  it("never returns EXACT_VERIFIED without verified identity", () => {
    const res = matchGarment(redDress, cat);
    expect(res.every((r) => r.match_label !== "EXACT_VERIFIED")).toBe(true);
  });

  it("only returns same-category candidates", () => {
    const res = matchGarment(redDress, cat);
    expect(res.every((r) => r.product.category === "dress")).toBe(true);
  });

  it("ranks a maroon dress above a black one (colour-closeness)", () => {
    const res = matchGarment(redDress, cat);
    const maroon = res.find((r) => r.product.id === "s21")!;
    const black = res.find((r) => r.product.id === "s3")!;
    expect(maroon.score).toBeGreaterThan(black.score);
  });

  it("applies the max price filter", () => {
    const res = matchGarment(redDress, cat, { max_price_inr: 1700 });
    expect(res.every((r) => (r.product.price_inr ?? 0) <= 1700)).toBe(true);
  });

  it("applies the size filter", () => {
    const res = matchGarment(redDress, cat, { sizes: ["XL"] });
    expect(res.every((r) => r.product.sizes?.includes("XL"))).toBe(true);
  });

  it("flags unverified stock as stale", () => {
    const floral: QueryGarment = {
      category: "dress",
      attributes: { primary_color: attr("blue"), pattern: attr("floral") },
    };
    const res = matchGarment(floral, cat);
    const s4 = res.find((r) => r.product.id === "s4");
    expect(s4?.stale_stock).toBe(true);
  });
});

describe("composeOutfit (budget)", () => {
  it("fits a top + bottom within INR 3000", () => {
    const top = matchGarment(
      { category: "top", attributes: { primary_color: attr("white"), pattern: attr("solid"), silhouette: attr("fitted") } },
      cat,
    );
    const jeans = matchGarment(
      { category: "jeans", attributes: { primary_color: attr("blue"), pattern: attr("solid"), silhouette: attr("straight") } },
      cat,
    );
    const slots: SlotShortlist[] = [
      { slot: "top", essential: true, options: top },
      { slot: "bottom", essential: true, options: jeans },
    ];
    const outfit = composeOutfit(slots, 3000);
    expect(outfit.within_budget).toBe(true);
    expect(outfit.total_inr).toBeLessThanOrEqual(3000);
    expect(outfit.coverage).toBe(1);
    expect(outfit.items).toHaveLength(2);
  });

  it("marks missing slots instead of fabricating when budget is too low", () => {
    const top = matchGarment(
      { category: "top", attributes: { primary_color: attr("white"), pattern: attr("solid") } },
      cat,
    );
    const slots: SlotShortlist[] = [{ slot: "top", essential: true, options: top }];
    const outfit = composeOutfit(slots, 100); // below any price
    expect(outfit.items).toHaveLength(0);
    expect(outfit.missing_slots).toContain("top");
  });
});

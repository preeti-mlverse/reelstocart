/**
 * Attribute-based candidate retrieval + reranking (Phases 7–8, minimal).
 *
 * This is the no-embedding baseline (pipeline C/D minus the visual vector). It is
 * honest about its ceiling: without verified product identity or a visual
 * embedding it NEVER returns EXACT_VERIFIED — the best bucket is VERY_CLOSE.
 * Hard mismatches (wrong category, clashing colour on a solid) are penalised hard.
 */
import type { MatchLabel } from "@rtc/schemas";

export interface SeedProduct {
  id: string;
  /** Database UUID when the product came from Postgres (enables /go tracking + product pages). */
  db_id?: string;
  merchant: string;
  brand?: string;
  title: string;
  category: string;
  product_url: string;
  image: string;
  color?: string;
  secondary_color?: string;
  pattern?: string;
  neckline?: string;
  sleeve_type?: string;
  silhouette?: string;
  garment_length?: string;
  price_inr?: number;
  mrp_inr?: number;
  sizes?: string[];
  availability?: "in_stock" | "out_of_stock" | "unverified";
  source_attribution: string;
  is_sample?: boolean;
}

export interface QueryGarment {
  category: string;
  attributes: Record<string, { value: unknown; confidence?: number } | undefined>;
}

export interface MatchFilters {
  max_price_inr?: number;
  sizes?: string[];
  merchants?: string[];
  in_stock_only?: boolean;
}

export interface ScoredMatch {
  product: SeedProduct;
  score: number;
  attribute_agreement: number;
  /** Fraction (0..1, by weight) of attributes that were comparable on both sides. */
  attribute_coverage?: number;
  match_label: MatchLabel;
  explanation: { similarities: string[]; differences: string[]; hard_mismatches: string[] };
  stale_stock: boolean;
}

const val = (q: QueryGarment, key: string): string | undefined => {
  const a = q.attributes[key];
  const v = a?.value;
  return typeof v === "string" ? v.toLowerCase() : undefined;
};

// Weighted attributes (configurable ranking weights, Phase 8).
const WEIGHTS: Record<string, number> = {
  primary_color: 0.28,
  pattern: 0.2,
  silhouette: 0.18,
  neckline: 0.12,
  sleeve_type: 0.12,
  garment_length: 0.1,
};

// Colour families: two colours are "close" if they share a family. Merchant feeds
// use fashion names (clay, rust, sage, saddle brown...) that a VLM reports as basic
// colours, so family overlap - not string equality - is the right test.
const COLOR_FAMILIES: string[][] = [
  ["red", "maroon", "crimson", "burgundy", "wine", "cherry"],
  ["pink", "rose", "blush", "fuchsia", "magenta", "salmon"],
  ["orange", "rust", "terracotta", "coral", "peach", "copper", "tangerine", "clay"],
  ["brown", "tan", "camel", "chocolate", "clay", "chestnut", "saddle", "mocha", "coffee", "rust", "terracotta", "copper", "cognac", "earth", "earthy"],
  ["yellow", "mustard", "gold", "golden", "lemon"],
  ["green", "olive", "emerald", "sage", "mint", "khaki", "forest", "bottle"],
  ["blue", "navy", "teal", "indigo", "denim", "sky", "cobalt", "royal", "ocean"],
  ["purple", "violet", "lavender", "lilac", "plum", "mauve"],
  ["white", "cream", "ivory", "off-white", "ecru", "offwhite"],
  ["beige", "sand", "nude", "camel", "cream", "taupe", "oat", "oatmeal", "stone", "khaki"],
  ["grey", "gray", "charcoal", "silver", "slate", "ash", "heather"],
  ["black", "charcoal", "jet", "onyx"],
];

const colorTokens = (c: string) => c.toLowerCase().split(/[\s/_-]+/).filter(Boolean);

function familiesOf(c: string): Set<number> {
  const out = new Set<number>();
  for (const t of [c.toLowerCase(), ...colorTokens(c)]) {
    COLOR_FAMILIES.forEach((fam, i) => { if (fam.includes(t)) out.add(i); });
  }
  return out;
}

export function colorClose(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const fa = familiesOf(a);
  for (const f of familiesOf(b)) if (fa.has(f)) return true;
  return false;
}

/**
 * Categories a detected garment may legitimately match. A VLM sees a co-ord set as
 * a separate top + bottom, while merchants list it as one `co_ord_set` product.
 */
const COMPATIBLE: Record<string, string[]> = {
  top: ["co_ord_set"],
  shirt: ["co_ord_set"],
  trousers: ["co_ord_set"],
  skirt: ["co_ord_set"],
};
export function compatibleCategories(category: string): string[] {
  return [category, ...(COMPATIBLE[category] ?? [])];
}

/** Total weight of all comparable attributes (for coverage). */
const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

function labelFor(score: number, hardMismatches: number): MatchLabel {
  if (hardMismatches > 0) return score >= 0.45 ? "STYLE_ALTERNATIVE" : "NO_RELIABLE_MATCH";
  if (score >= 0.82) return "VERY_CLOSE"; // never EXACT_VERIFIED without verified identity
  if (score >= 0.6) return "SIMILAR";
  if (score >= 0.4) return "STYLE_ALTERNATIVE";
  return "NO_RELIABLE_MATCH";
}

/** Mandatory filters first (category/price/size/merchant/stock), then rerank. */
export function matchGarment(
  garment: QueryGarment,
  catalogue: SeedProduct[],
  filters: MatchFilters = {},
  limit = 20,
): ScoredMatch[] {
  const qColor = val(garment, "primary_color");
  const qPattern = val(garment, "pattern");

  const allowed = compatibleCategories(garment.category);
  const candidates = catalogue.filter((p) => {
    if (!allowed.includes(p.category)) return false; // hard category filter (co-ord aware)
    if (filters.max_price_inr != null && (p.price_inr ?? Infinity) > filters.max_price_inr) return false;
    if (filters.merchants?.length && !filters.merchants.includes(p.merchant)) return false;
    if (filters.in_stock_only && p.availability !== "in_stock") return false;
    if (filters.sizes?.length && !(p.sizes ?? []).some((s) => filters.sizes!.includes(s))) return false;
    return true;
  });

  const scored = candidates.map<ScoredMatch>((p) => {
    const similarities: string[] = [];
    const differences: string[] = [];
    const hard: string[] = [];
    let agree = 0;
    let weightSum = 0;

    const compare = (key: string, qv?: string, pv?: string, pretty?: string) => {
      const w = WEIGHTS[key] ?? 0;
      if (qv == null || pv == null) return; // unknown on either side — don't penalise
      weightSum += w;
      if (qv === pv) {
        agree += w;
        similarities.push(`${pretty ?? key}: ${pv}`);
      } else if (key === "primary_color" && colorClose(qv, pv)) {
        agree += w * 0.6;
        similarities.push(`colour close (${qv}→${pv})`);
      } else {
        differences.push(`${pretty ?? key}: wanted ${qv}, got ${pv}`);
      }
    };

    compare("primary_color", qColor, p.color?.toLowerCase(), "colour");
    compare("pattern", qPattern, p.pattern?.toLowerCase());
    compare("silhouette", val(garment, "silhouette"), p.silhouette?.toLowerCase());
    compare("neckline", val(garment, "neckline"), p.neckline?.toLowerCase());
    compare("sleeve_type", val(garment, "sleeve_type"), p.sleeve_type?.toLowerCase());
    compare("garment_length", val(garment, "garment_length"), p.garment_length?.toLowerCase());

    if (p.category !== garment.category) {
      differences.push(`sold as ${p.category.replace(/_/g, " ")}`);
    }

    // Hard mismatch: strong colour clash on a solid garment is a real signal.
    if (qColor && p.color && qPattern === "solid" && p.pattern?.toLowerCase() === "solid" && !colorClose(qColor, p.color.toLowerCase())) {
      hard.push(`solid colour clash: ${qColor} vs ${p.color}`);
    }

    // Partial-category (co-ord piece) matches are slightly discounted.
    const catFactor = p.category === garment.category ? 1 : 0.9;
    const base = (weightSum > 0 ? agree / weightSum : 0) * catFactor;
    const score = Math.max(0, base - hard.length * 0.35);
    return {
      product: p,
      score: Number(score.toFixed(3)),
      attribute_agreement: Number(base.toFixed(3)),
      attribute_coverage: Number((weightSum / TOTAL_WEIGHT).toFixed(3)),
      match_label: labelFor(score, hard.length),
      explanation: { similarities, differences, hard_mismatches: hard },
      stale_stock: p.availability === "unverified",
    };
  });

  const ranked = scored.sort((a, b) => b.score - a.score).slice(0, limit);
  // If nothing clears the bar, be honest.
  if (ranked.length === 0 || ranked.every((r) => r.match_label === "NO_RELIABLE_MATCH")) {
    return ranked;
  }
  return ranked;
}

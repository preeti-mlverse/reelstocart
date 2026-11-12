/**
 * Versioned fashion taxonomy (Phase 5).
 * Bump TAXONOMY_VERSION on any breaking change; attributes are stored with the
 * version that produced them so historical data stays interpretable.
 */
export const TAXONOMY_VERSION = "2026.11.0";

/** Categories supported at launch. Expansion (footwear/bags/jewellery/men's) adds branches, not rewrites. */
export const CATEGORIES = [
  "top",
  "dress",
  "shirt",
  "skirt",
  "jeans",
  "trousers",
  "co_ord_set",
  "jacket",
  "blazer",
  // future-reserved (not launched):
  "footwear",
  "bag",
  "jewellery",
  "accessory",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LAUNCH_CATEGORIES: Category[] = [
  "top", "dress", "shirt", "skirt", "jeans", "trousers", "co_ord_set", "jacket", "blazer",
];

export const NECKLINES = [
  "crew", "v_neck", "scoop", "sweetheart", "halter", "boat", "square",
  "collared", "off_shoulder", "one_shoulder", "high_neck", "cowl", "unknown",
] as const;

export const SLEEVE_TYPES = [
  "sleeveless", "cap", "short", "three_quarter", "long", "puff",
  "bell", "balloon", "bishop", "spaghetti_strap", "strapless", "unknown",
] as const;

export const SLEEVE_LENGTHS = ["none", "short", "elbow", "three_quarter", "long", "unknown"] as const;

export const SILHOUETTES = [
  "fitted", "relaxed", "oversized", "straight", "a_line", "flared",
  "bodycon", "wide_leg", "cropped", "unknown",
] as const;

export const PATTERNS = [
  "solid", "stripe", "check", "floral", "polka_dot", "geometric", "animal",
  "abstract", "paisley", "colour_block", "tie_dye", "unknown",
] as const;

export const HEMLINES = ["straight", "curved", "asymmetric", "high_low", "handkerchief", "unknown"] as const;

export const CLOSURES = ["pullover", "button", "zip", "wrap", "tie", "hook", "none", "unknown"] as const;

export const GARMENT_LENGTHS = ["cropped", "waist", "hip", "thigh", "knee", "midi", "ankle", "floor", "unknown"] as const;

export const STYLE_FAMILIES = [
  "casual", "formal", "ethnic", "party", "streetwear", "athleisure",
  "office", "boho", "minimal", "y2k", "unknown",
] as const;

export const OCCASIONS = [
  "everyday", "work", "party", "wedding", "festive", "vacation", "date", "unknown",
] as const;

/** Evidence source for an attribute value — keeps visible / inferred / verified separate. */
export const EVIDENCE = ["visible", "inferred", "merchant_verified", "unknown"] as const;
export type Evidence = (typeof EVIDENCE)[number];

/** Match quality buckets (Phase 8). */
export const MATCH_LABELS = [
  "EXACT_VERIFIED",
  "VERY_CLOSE",
  "SIMILAR",
  "STYLE_ALTERNATIVE",
  "NO_RELIABLE_MATCH",
] as const;
export type MatchLabel = (typeof MATCH_LABELS)[number];

/** Media/job status machine (Phase 2). */
export const MEDIA_STATUS = [
  "VALIDATING",
  "RESOLVING",
  "MEDIA_ACCESSIBLE",
  "PREVIEW_ONLY",
  "UPLOAD_REQUIRED",
  "PROCESSING",
  "COMPLETE",
  "FAILED",
  "UNSUPPORTED",
] as const;
export type MediaStatus = (typeof MEDIA_STATUS)[number];

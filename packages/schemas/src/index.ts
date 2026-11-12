import { z } from "zod";
import {
  CATEGORIES, NECKLINES, SLEEVE_TYPES, SLEEVE_LENGTHS, SILHOUETTES, PATTERNS,
  HEMLINES, CLOSURES, GARMENT_LENGTHS, STYLE_FAMILIES, OCCASIONS, EVIDENCE,
  MATCH_LABELS, MEDIA_STATUS, TAXONOMY_VERSION,
} from "./taxonomy";

export * from "./taxonomy";

/** A single attribute value carries its own confidence, evidence source, and unknown flag. */
export const AttributeValue = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.enum(EVIDENCE),
    unknown: z.boolean().default(false),
  });

const enumAttr = (vals: readonly [string, ...string[]]) => AttributeValue(z.enum(vals));
const strAttr = AttributeValue(z.string());

/** Full garment attribute set (Phase 5). Nullable + unknown-flagged so we never fabricate. */
export const GarmentAttributes = z.object({
  category: enumAttr(CATEGORIES),
  subcategory: strAttr.optional(),
  primary_color: strAttr,
  secondary_color: strAttr.optional(),
  color_palette: AttributeValue(z.array(z.string())).optional(),
  pattern: enumAttr(PATTERNS),
  neckline: enumAttr(NECKLINES).optional(),
  sleeve_type: enumAttr(SLEEVE_TYPES).optional(),
  sleeve_length: enumAttr(SLEEVE_LENGTHS).optional(),
  silhouette: enumAttr(SILHOUETTES),
  hemline: enumAttr(HEMLINES).optional(),
  garment_length: enumAttr(GARMENT_LENGTHS).optional(),
  closure: enumAttr(CLOSURES).optional(),
  texture: strAttr.optional(),
  embellishments: AttributeValue(z.array(z.string())).optional(),
  style_family: enumAttr(STYLE_FAMILIES).optional(),
  occasion: AttributeValue(z.array(z.enum(OCCASIONS))).optional(),
  // fabric: visually-suggested only; never claim exact composition from imagery.
  fabric_appearance: strAttr.optional(),
  taxonomy_version: z.string().default(TAXONOMY_VERSION),
});
export type GarmentAttributes = z.infer<typeof GarmentAttributes>;

export const BBox = z.tuple([z.number(), z.number(), z.number(), z.number()]); // [x,y,w,h] normalized 0..1

export const DetectedGarment = z.object({
  garment_id: z.string(),
  category: z.enum(CATEGORIES),
  bbox: BBox.nullable(),
  mask_rle: z.string().nullable().optional(),
  source_frame: z.string().nullable().optional(),
  outfit_id: z.string().nullable().optional(),
  person_id: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  occlusion: z.boolean().default(false),
  visible_region_quality: z.number().min(0).max(1).optional(),
  attributes: GarmentAttributes,
});
export type DetectedGarment = z.infer<typeof DetectedGarment>;

export const DetectedOutfit = z.object({
  outfit_id: z.string(),
  representative_frame: z.string(),
  timestamps: z.array(z.number()).default([]),
  associated_frames: z.array(z.string()).default([]),
  detected_people: z.array(z.string()).default([]),
  candidate_garments: z.array(z.string()).default([]),
  image_quality: z.number().min(0).max(1),
  uncertainty: z.string().optional(),
});
export type DetectedOutfit = z.infer<typeof DetectedOutfit>;

export const ModelInfo = z.object({
  name: z.string(),
  version: z.string(),
  provider: z.string(),
  mode: z.enum(["DEVELOPMENT_MOCK", "REAL_LOCAL", "REAL_HOSTED"]),
});

export const VisionAnalysis = z.object({
  garments: z.array(DetectedGarment),
  outfits: z.array(DetectedOutfit).default([]),
  model: ModelInfo,
  cost_usd: z.number().nonnegative().default(0),
  latency_ms: z.number().nonnegative().default(0),
  warnings: z.array(z.string()).default([]),
});
export type VisionAnalysis = z.infer<typeof VisionAnalysis>;

/** Product (Phase 6). Required fields enforce "never fabricate": every product has a real source + url + image. */
export const Product = z.object({
  id: z.string(),
  source_id: z.string(),
  merchant_id: z.string(),
  brand: z.string().nullable().optional(),
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  product_url: z.string().url(),
  source_attribution: z.string(),
  images: z.array(z.string().url()).min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  pattern: z.string().optional(),
  fabric: z.string().optional(),
  fit: z.string().optional(),
  sizes: z.array(z.string()).default([]),
  price_inr: z.number().nonnegative().nullable().optional(),
  mrp_inr: z.number().nonnegative().nullable().optional(),
  availability: z.enum(["in_stock", "out_of_stock", "unverified"]).default("unverified"),
  delivery_regions: z.array(z.string()).default([]),
  affiliate_url: z.string().url().nullable().optional(),
  // provenance
  verified_at: z.string().datetime().nullable().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});
export type Product = z.infer<typeof Product>;

export const MatchResult = z.object({
  product: Product,
  match_label: z.enum(MATCH_LABELS),
  score: z.number().min(0).max(1),
  visual_similarity: z.number().min(0).max(1).optional(),
  attribute_agreement: z.number().min(0).max(1).optional(),
  explanation: z.object({
    similarities: z.array(z.string()),
    differences: z.array(z.string()),
    hard_mismatches: z.array(z.string()).default([]),
  }),
  stale_stock: z.boolean().default(false),
});
export type MatchResult = z.infer<typeof MatchResult>;

export const SearchFilters = z.object({
  max_price_inr: z.number().positive().optional(),
  sizes: z.array(z.string()).optional(),
  merchants: z.array(z.string()).optional(),
  in_stock_only: z.boolean().optional(),
  ship_to_region: z.string().optional(),
});
export type SearchFilters = z.infer<typeof SearchFilters>;

/** API request to start a search. */
export const SearchRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url() }),
  z.object({ kind: z.literal("image_url"), url: z.string().url() }),
  z.object({ kind: z.literal("upload"), mediaId: z.string() }),
]);
export type SearchRequest = z.infer<typeof SearchRequest>;

export const JobStatus = z.enum(MEDIA_STATUS);

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retriable: z.boolean().default(false),
    details: z.record(z.string(), z.any()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

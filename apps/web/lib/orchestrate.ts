/**
 * Full search orchestration (framework-agnostic so it can be unit-run in Node):
 * image bytes -> vision service (garments+attributes) -> matcher over catalogue.
 */
import {
  matchGarment, rerankHybrid, rerankWithVisual, annSearch, compatibleCategories, loadSeedCatalogue, loadSeedEmbeddings, composeOutfit,
  type QueryGarment, type ScoredMatch, type MatchFilters, type SeedProduct, type EmbeddingMap,
} from "@rtc/search";
import { pool as sharedPool, logSearchJob } from "./db";

// Load catalogue + embeddings once per server process.
let _catalogue: SeedProduct[] | null = null;
let _embeddings: EmbeddingMap | null = null;
const catalogue = () => (_catalogue ??= loadSeedCatalogue());
const embeddings = () => (_embeddings ??= loadSeedEmbeddings());

// Optional pgvector retrieval (Phase 7). Enabled by USE_PGVECTOR=true + DATABASE_URL.
const usePgvector = () => process.env.USE_PGVECTOR === "true" && !!process.env.DATABASE_URL;
async function getPool() {
  return (await sharedPool()) as unknown as { query(t: string, p?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }> };
}

/**
 * Retrieval strategy per garment:
 *  1. pgvector ANN -> hybrid rerank (when enabled & the garment has an embedding)
 *  2. in-process hybrid (embedding + precomputed vectors)
 *  3. attribute-only (no embedding)
 * Each step falls back to the next on failure, so the request never dies on infra.
 */
async function matchFor(g: VisionGarment, filters: MatchFilters): Promise<ScoredMatch[]> {
  const q: QueryGarment = { category: g.category, attributes: g.attributes };
  if (g.embedding && usePgvector()) {
    try {
      const pool = await getPool();
      const candidates = await annSearch(pool, g.embedding, { categories: compatibleCategories(g.category), limit: 100 });
      if (candidates.length) return rerankWithVisual(q, candidates, filters, undefined, 12);
    } catch {
      /* fall through to in-process */
    }
  }
  const emb = embeddings();
  if (g.embedding && Object.keys(emb).length > 0) {
    return rerankHybrid(q, g.embedding, catalogue(), emb, filters, undefined, 12);
  }
  return matchGarment(q, catalogue(), filters, 12);
}

export const retrievalMode = () => (usePgvector() ? "pgvector" : "in_process");

export interface VisionGarment {
  garment_id: string;
  category: string;
  bbox: number[] | null;
  confidence: number;
  occlusion?: boolean;
  person_id?: string;
  embedding?: number[];
  embedding_model?: string;
  attributes: Record<string, { value: unknown; confidence?: number } | undefined>;
}

export interface VisionResponse {
  garments: VisionGarment[];
  outfits: unknown[];
  model: { name: string; mode: string };
  cost_usd: number;
  latency_ms: number;
  warnings: string[];
}

export interface GarmentWithMatches {
  garment: VisionGarment;
  matches: ScoredMatch[];
}

export interface ComposedLook {
  items: { slot: string; category: string; match: ScoredMatch }[];
  total_inr: number;
  budget_inr: number;
  coverage: number;
  missing_slots: string[];
  within_budget: boolean;
}

export interface SearchOutput {
  model: VisionResponse["model"];
  cost_usd: number;
  warnings: string[];
  retrieval: string;
  job_id: string | null;
  results: GarmentWithMatches[];
  look: ComposedLook | null;
}

export interface SearchOptions {
  /** Total budget for the whole look (Phase 9 composer). */
  budget_inr?: number;
}

/** Phase 9: assemble the best complete look under a total budget (needs >= 2 garments). */
export function buildLook(results: GarmentWithMatches[], budget?: number): ComposedLook | null {
  if (!budget || budget <= 0 || results.length < 2) return null;
  const catOf = new Map(results.map((r) => [r.garment.garment_id, r.garment.category]));
  const out = composeOutfit(
    results.map((r) => ({ slot: r.garment.garment_id, essential: false, options: r.matches })),
    budget,
  );
  // A co-ord set can fill both the top and bottom slot: show it once, naming both pieces.
  const merged = new Map<string, { slot: string; category: string; match: ScoredMatch }>();
  for (const i of out.items) {
    const key = i.match.product.db_id ?? i.match.product.id;
    const cat = catOf.get(i.slot) ?? i.slot;
    const prev = merged.get(key);
    if (prev) prev.category = `${prev.category} + ${cat}`;
    else merged.set(key, { slot: i.slot, category: cat, match: i.match });
  }
  return {
    items: [...merged.values()],
    total_inr: out.total_inr,
    budget_inr: budget,
    coverage: out.coverage,
    missing_slots: out.missing_slots.map((m) => catOf.get(m) ?? m),
    within_budget: out.within_budget,
  };
}

const dbIdsOf = (groups: GarmentWithMatches[]) =>
  groups.flatMap((r) => r.matches.slice(0, 8).map((m) => m.product.db_id).filter((x): x is string => !!x));

const summaryOf = (groups: GarmentWithMatches[]) =>
  groups.map((r) => ({
    category: r.garment.category,
    top: r.matches.slice(0, 3).map((m) => ({ id: m.product.db_id ?? m.product.id, label: m.match_label, score: +m.score.toFixed(3) })),
  }));

/** Call the FastAPI vision service with an image. */
export async function analyzeImage(
  visionUrl: string,
  bytes: Uint8Array,
  filename = "upload.jpg",
  mime = "image/jpeg",
): Promise<VisionResponse> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  const res = await fetch(`${visionUrl}/v1/analyze/image`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`vision_error_${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as VisionResponse;
}

export interface VisionOutfit {
  outfit_id: string;
  timestamp: number;
  timestamps: number[];
  scene_change: boolean;
  representative_frame_b64: string;
  image_quality: number;
  garments: VisionGarment[];
}

export interface VisionVideoResponse {
  frames_selected: { t: number; scene_change: boolean; sharpness: number }[];
  outfits: VisionOutfit[];
  model: { name: string; mode: string };
  cost_usd: number;
  warnings: string[];
}

export interface OutfitWithMatches {
  outfit_id: string;
  timestamp: number;
  scene_change: boolean;
  representative_frame_b64: string;
  image_quality: number;
  garments: GarmentWithMatches[];
}

export interface VideoSearchOutput {
  model: { name: string; mode: string };
  cost_usd: number;
  warnings: string[];
  retrieval: string;
  job_id: string | null;
  frames_selected: VisionVideoResponse["frames_selected"];
  outfits: OutfitWithMatches[];
}

/** Call the vision service with a video (adaptive frame sampling + outfit grouping). */
export async function analyzeVideo(
  visionUrl: string,
  bytes: Uint8Array,
  filename = "clip.mp4",
  mime = "video/mp4",
): Promise<VisionVideoResponse> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  const res = await fetch(`${visionUrl}/v1/analyze/video`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`vision_video_error_${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as VisionVideoResponse;
}

/** Full video chain: sample frames -> detect outfits -> match each garment. */
export async function runVideoSearch(
  visionUrl: string,
  bytes: Uint8Array,
  filters: MatchFilters = {},
  filename?: string,
  mime?: string,
): Promise<VideoSearchOutput> {
  const t0 = Date.now();
  const vision = await analyzeVideo(visionUrl, bytes, filename, mime);
  const outfits: OutfitWithMatches[] = await Promise.all(
    vision.outfits.map(async (o) => ({
      outfit_id: o.outfit_id,
      timestamp: o.timestamp,
      scene_change: o.scene_change,
      representative_frame_b64: o.representative_frame_b64,
      image_quality: o.image_quality,
      garments: await Promise.all(
        o.garments.map(async (g) => ({ garment: g, matches: await matchFor(g, filters) })),
      ),
    })),
  );
  const all = outfits.flatMap((o) => o.garments);
  const job_id = await logSearchJob({
    kind: "video", cost_usd: vision.cost_usd, model: vision.model.name, latency_ms: Date.now() - t0,
    summary: { outfits: outfits.length, garments: summaryOf(all) }, productIds: dbIdsOf(all),
  });
  return { model: vision.model, cost_usd: vision.cost_usd, warnings: vision.warnings,
           retrieval: retrievalMode(), job_id, frames_selected: vision.frames_selected, outfits };
}

/** Run the whole chain and attach catalogue matches per detected garment. */
export async function runSearch(
  visionUrl: string,
  bytes: Uint8Array,
  filters: MatchFilters = {},
  filename?: string,
  mime?: string,
  opts: SearchOptions = {},
): Promise<SearchOutput> {
  const t0 = Date.now();
  const vision = await analyzeImage(visionUrl, bytes, filename, mime);
  const results = await Promise.all(
    vision.garments.map(async (g) => ({ garment: g, matches: await matchFor(g, filters) })),
  );
  const look = buildLook(results, opts.budget_inr);
  const job_id = await logSearchJob({
    kind: "image", cost_usd: vision.cost_usd, model: vision.model.name, latency_ms: Date.now() - t0,
    summary: { garments: summaryOf(results), budget_inr: opts.budget_inr ?? null }, productIds: dbIdsOf(results),
  });
  return { model: vision.model, cost_usd: vision.cost_usd, warnings: vision.warnings, retrieval: retrievalMode(), job_id, results, look };
}

/**
 * Full search orchestration (framework-agnostic so it can be unit-run in Node):
 * image bytes -> vision service (garments+attributes) -> matcher over catalogue.
 */
import {
  matchGarment, rerankHybrid, loadSeedCatalogue, loadSeedEmbeddings,
  type QueryGarment, type ScoredMatch, type MatchFilters, type SeedProduct, type EmbeddingMap,
} from "@rtc/search";

// Load catalogue + embeddings once per server process.
let _catalogue: SeedProduct[] | null = null;
let _embeddings: EmbeddingMap | null = null;
const catalogue = () => (_catalogue ??= loadSeedCatalogue());
const embeddings = () => (_embeddings ??= loadSeedEmbeddings());

/** Hybrid when the garment has a visual embedding + we have product embeddings; else attribute-only. */
function matchFor(g: VisionGarment, filters: MatchFilters): ScoredMatch[] {
  const emb = embeddings();
  const q: QueryGarment = { category: g.category, attributes: g.attributes };
  if (g.embedding && Object.keys(emb).length > 0) {
    return rerankHybrid(q, g.embedding, catalogue(), emb, filters, undefined, 12);
  }
  return matchGarment(q, catalogue(), filters, 12);
}

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

export interface SearchOutput {
  model: VisionResponse["model"];
  cost_usd: number;
  warnings: string[];
  results: GarmentWithMatches[];
}

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
  const vision = await analyzeVideo(visionUrl, bytes, filename, mime);
  const outfits: OutfitWithMatches[] = vision.outfits.map((o) => ({
    outfit_id: o.outfit_id,
    timestamp: o.timestamp,
    scene_change: o.scene_change,
    representative_frame_b64: o.representative_frame_b64,
    image_quality: o.image_quality,
    garments: o.garments.map((g) => ({ garment: g, matches: matchFor(g, filters) })),
  }));
  return { model: vision.model, cost_usd: vision.cost_usd, warnings: vision.warnings,
           frames_selected: vision.frames_selected, outfits };
}

/** Run the whole chain and attach catalogue matches per detected garment. */
export async function runSearch(
  visionUrl: string,
  bytes: Uint8Array,
  filters: MatchFilters = {},
  filename?: string,
  mime?: string,
): Promise<SearchOutput> {
  const vision = await analyzeImage(visionUrl, bytes, filename, mime);
  const results = vision.garments.map((g) => ({ garment: g, matches: matchFor(g, filters) }));
  return { model: vision.model, cost_usd: vision.cost_usd, warnings: vision.warnings, results };
}

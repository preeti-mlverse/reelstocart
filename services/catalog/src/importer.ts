/**
 * Catalogue importer core (Phase 6): parse a CSV/JSON feed, validate + normalize
 * rows onto our taxonomy, dedupe by source_id. Pure (no I/O) so it is unit-tested.
 * Rows that fail validation are collected as errors, never silently dropped.
 */
import { parseCsv } from "./csv";
import {
  normalizeCategory, normalizeColor, normalizePattern, normalizeSilhouette,
  parseSizes, parseNumber, normalizeAvailability,
} from "./mappers";

export interface NormalizedProduct {
  source_id: string;
  title: string;
  category: string;
  product_url: string;
  image: string;
  brand?: string;
  description?: string;
  color?: string;
  pattern?: string;
  silhouette?: string;
  fabric?: string;
  fit?: string;
  sizes: string[];
  price_inr: number | null;
  mrp_inr: number | null;
  availability: "in_stock" | "out_of_stock" | "unverified";
  source_attribution: string;
}

export interface RowError {
  row: number;
  source_id?: string;
  reason: string;
}

export interface NormalizeResult {
  products: NormalizedProduct[];
  errors: RowError[];
  duplicates: number;
  total: number;
}

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k] != null && r[k]!.trim() !== "") return r[k]!.trim();
  return "";
};

function isHttpUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseFeed(text: string, format: "csv" | "json"): Record<string, string>[] {
  if (format === "json") {
    const data = JSON.parse(text);
    const arr: unknown[] = Array.isArray(data) ? data : (data.products ?? data.items ?? []);
    return arr.map((o) => {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        row[k] = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
      }
      return row;
    });
  }
  return parseCsv(text);
}

export function validateAndNormalize(rows: Record<string, string>[], merchantSlug: string): NormalizeResult {
  const products: NormalizedProduct[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  rows.forEach((r, i) => {
    const line = i + 2; // account for header + 1-based
    const sid = pick(r, "source_id", "id", "sku", "handle");
    const title = pick(r, "title", "name", "product_title");
    const catRaw = pick(r, "category", "product_type", "type");
    const url = pick(r, "product_url", "url", "link");
    const img = (pick(r, "image", "image_url", "image_link", "images").split(/[|,]/)[0] ?? "").trim();

    if (!sid) { errors.push({ row: line, reason: "missing source_id" }); return; }
    if (!title) { errors.push({ row: line, source_id: sid, reason: "missing title" }); return; }
    const cat = normalizeCategory(catRaw);
    if (!cat) { errors.push({ row: line, source_id: sid, reason: `unmappable category: '${catRaw}'` }); return; }
    if (!isHttpUrl(url)) { errors.push({ row: line, source_id: sid, reason: "invalid product_url" }); return; }
    if (!isHttpUrl(img)) { errors.push({ row: line, source_id: sid, reason: "missing/invalid image" }); return; }
    if (seen.has(sid)) { duplicates++; return; }
    seen.add(sid);

    products.push({
      source_id: sid,
      title,
      category: cat,
      product_url: url,
      image: img,
      brand: pick(r, "brand", "vendor") || undefined,
      description: pick(r, "description", "body") || undefined,
      color: normalizeColor(pick(r, "color", "colour")),
      pattern: normalizePattern(pick(r, "pattern", "print")),
      silhouette: normalizeSilhouette(pick(r, "silhouette", "fit")),
      fabric: pick(r, "fabric", "material") || undefined,
      fit: pick(r, "fit") || undefined,
      sizes: parseSizes(pick(r, "sizes", "size")),
      price_inr: parseNumber(pick(r, "price_inr", "price")),
      mrp_inr: parseNumber(pick(r, "mrp_inr", "mrp", "compare_at_price")),
      availability: normalizeAvailability(pick(r, "availability", "in_stock")),
      source_attribution: merchantSlug,
    });
  });

  return { products, errors, duplicates, total: rows.length };
}

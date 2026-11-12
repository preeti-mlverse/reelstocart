/**
 * Normalize free-text merchant feed values onto our versioned taxonomy (Phase 6).
 * Unknown categories are rejected (never silently mis-mapped).
 */
import { LAUNCH_CATEGORIES, PATTERNS, SILHOUETTES, type Category } from "@rtc/schemas/taxonomy";

const CATEGORY_SYNONYMS: Record<string, Category> = {
  dress: "dress", dresses: "dress", gown: "dress", frock: "dress",
  top: "top", tops: "top", tee: "top", "t-shirt": "top", tshirt: "top", tank: "top", blouse: "top", "crop top": "top",
  shirt: "shirt", shirts: "shirt",
  skirt: "skirt", skirts: "skirt",
  jeans: "jeans", jean: "jeans", denim: "jeans",
  trouser: "trousers", trousers: "trousers", pant: "trousers", pants: "trousers", chinos: "trousers",
  "co-ord": "co_ord_set", coord: "co_ord_set", "co-ord set": "co_ord_set", "coord set": "co_ord_set", "co ord": "co_ord_set", set: "co_ord_set",
  jacket: "jacket", jackets: "jacket",
  blazer: "blazer", blazers: "blazer",
};

export function normalizeCategory(raw: string): Category | null {
  const k = raw.trim().toLowerCase();
  if ((LAUNCH_CATEGORIES as string[]).includes(k)) return k as Category;
  return CATEGORY_SYNONYMS[k] ?? null;
}

const COLOR_SYNONYMS: Record<string, string> = {
  navy: "navy", "navy blue": "navy", "off white": "white", "off-white": "white", ivory: "white",
  tan: "beige", camel: "beige", nude: "beige", khaki: "olive", wine: "maroon", burgundy: "maroon",
};
export function normalizeColor(raw: string): string | undefined {
  const k = raw.trim().toLowerCase();
  if (!k) return undefined;
  return COLOR_SYNONYMS[k] ?? k;
}

export function normalizeEnum(raw: string, allowed: readonly string[]): string | undefined {
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (allowed as string[]).includes(k) ? k : undefined;
}
export const normalizePattern = (raw: string) => normalizeEnum(raw, PATTERNS);
export const normalizeSilhouette = (raw: string) => normalizeEnum(raw, SILHOUETTES);

export function parseSizes(raw: string): string[] {
  return raw.split(/[|,;/]/).map((s) => s.trim()).filter(Boolean);
}

export function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw.replace(/[₹,$\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function normalizeAvailability(raw: string | undefined): "in_stock" | "out_of_stock" | "unverified" {
  const k = (raw ?? "").trim().toLowerCase();
  if (["in_stock", "in stock", "instock", "available", "true", "yes", "1"].includes(k)) return "in_stock";
  if (["out_of_stock", "out of stock", "oos", "unavailable", "false", "no", "0"].includes(k)) return "out_of_stock";
  return "unverified";
}

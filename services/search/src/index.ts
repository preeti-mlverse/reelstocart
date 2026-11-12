export * from "./matcher";
export * from "./composer";
export * from "./hybrid";

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SeedProduct } from "./matcher";
import type { EmbeddingMap } from "./hybrid";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load the sample seed catalogue (fixture data; replace with real feeds in Phase 6). */
export function loadSeedCatalogue(): SeedProduct[] {
  const p = join(__dirname, "..", "data", "seed-catalogue.json");
  const json = JSON.parse(readFileSync(p, "utf8"));
  return json.products as SeedProduct[];
}

/** Load precomputed product embeddings (id -> vector), or {} if not generated yet. */
export function loadSeedEmbeddings(): EmbeddingMap {
  const p = join(__dirname, "..", "data", "seed-embeddings.json");
  if (!existsSync(p)) return {};
  const json = JSON.parse(readFileSync(p, "utf8"));
  return (json.embeddings ?? json) as EmbeddingMap;
}

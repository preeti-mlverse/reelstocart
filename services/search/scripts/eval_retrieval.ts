/**
 * Phase 13 — retrieval evaluation harness (visual stage, no paid model calls).
 *
 *   tsx services/search/scripts/eval_retrieval.ts [--out docs/eval/retrieval-latest.md]
 *
 * 1. Exports every real (non-fixture) catalogue product that has an embedding.
 * 2. Runs services/vision/scripts/eval_queries.py to turn each product photo into a
 *    reel-style screenshot and embed it via the vision service.
 * 3. For each query, runs the production ANN query (annSearch, category-filtered,
 *    co-ord-aware) and measures where the source product lands.
 *
 * Reports Recall@1/@5, MRR, and the visual-similarity distribution of the true
 * product vs the best *other* product — which is what calibrates the
 * VERY_CLOSE near-duplicate threshold in hybrid.ts. Numbers are real, computed
 * here; nothing is fabricated if a step fails.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { annSearch, compatibleCategories } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const outArg = process.argv.indexOf("--out");
const outPath = resolve(root, outArg > 0 ? process.argv[outArg + 1]! : "docs/eval/retrieval-latest.md");
const tmp = join(root, ".eval-tmp");
mkdirSync(tmp, { recursive: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]! : NaN;
};
const f3 = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "—");

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const { rows: products } = await pool.query(
    `SELECT p.id::text AS id, p.category, p.attributes->>'image' AS image
       FROM product p JOIN product_embedding e ON e.product_id = p.id
      WHERE p.deleted_at IS NULL AND COALESCE((p.attributes->>'is_sample')::boolean,false) = false
        AND p.attributes->>'image' LIKE 'https://%'`,
  );
  writeFileSync(join(tmp, "products.json"), JSON.stringify(products));

  const py = process.env.VISION_PYTHON ||
    join(root, "services/vision/.venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const pyOut = execFileSync(py, ["-I", join(root, "services/vision/scripts/eval_queries.py"),
    join(tmp, "products.json"), join(tmp, "queries.json")], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  console.log("queries:", pyOut.trim());
  const queries: { id: string; category: string; embedding: number[] }[] =
    JSON.parse(readFileSync(join(tmp, "queries.json"), "utf8"));

  const ranks: (number | null)[] = [];
  const trueSims: number[] = [];
  const bestOtherSims: number[] = [];
  const gaps: number[] = [];
  const perCat: Record<string, { n: number; r1: number; r5: number }> = {};

  for (const qy of queries) {
    const cands = await annSearch(pool, qy.embedding, { categories: compatibleCategories(qy.category), limit: 50 });
    const idx = cands.findIndex((c) => c.product.db_id === qy.id);
    const rank = idx >= 0 ? idx + 1 : null;
    ranks.push(rank);
    const t = idx >= 0 ? cands[idx]!.visual_similarity : NaN;
    const other = cands.find((c) => c.product.db_id !== qy.id)?.visual_similarity ?? NaN;
    if (Number.isFinite(t)) trueSims.push(t);
    if (Number.isFinite(other)) bestOtherSims.push(other);
    if (Number.isFinite(t) && Number.isFinite(other)) gaps.push(t - other);
    const pc = (perCat[qy.category] ??= { n: 0, r1: 0, r5: 0 });
    pc.n++; if (rank === 1) pc.r1++; if (rank !== null && rank <= 5) pc.r5++;
  }
  await pool.end();

  const n = ranks.length;
  const r1 = ranks.filter((r) => r === 1).length / n;
  const r5 = ranks.filter((r) => r !== null && r <= 5).length / n;
  const mrr = ranks.reduce<number>((s, r) => s + (r ? 1 / r : 0), 0) / n;
  // Smallest threshold above (almost) all best-other sims => near-duplicate floor.
  const suggested = pct(bestOtherSims, 98);
  const coverage = trueSims.filter((s) => s > suggested).length / Math.max(1, trueSims.length);

  const md = `# Retrieval evaluation (visual stage)

_Generated ${new Date().toISOString()} by \`services/search/scripts/eval_retrieval.ts\`._

**Setup.** ${n} real catalogue products (non-fixture, with embeddings). Each product photo is turned into a
reel-style screenshot (9:16 frame, random 82–95% off-centre crop, blurred fill, UI bars, JPEG q=70), embedded with
the production FashionCLIP model, and queried with the production pgvector ANN query (category-filtered, co-ord aware).
No LLM calls; this isolates visual retrieval. Caveat: the query photo is derived from the catalogue photo, so this
measures robustness to screenshot framing/compression, **not** cross-photo (street → studio) matching.

| Metric | Value |
|---|---|
| Queries | ${n} |
| Recall@1 | ${(r1 * 100).toFixed(1)}% |
| Recall@5 | ${(r5 * 100).toFixed(1)}% |
| MRR | ${f3(mrr)} |
| True-product visual sim (p5 / median) | ${f3(pct(trueSims, 5))} / ${f3(pct(trueSims, 50))} |
| Best *other* product sim (median / p98) | ${f3(pct(bestOtherSims, 50))} / ${f3(pct(bestOtherSims, 98))} |
| Gap true − best other (p5 / median) | ${f3(pct(gaps, 5))} / ${f3(pct(gaps, 50))} |
| Suggested near-duplicate threshold (p98 of best-other) | ${f3(suggested)} → covers ${(coverage * 100).toFixed(0)}% of true matches |

## Per category
| Category | n | R@1 | R@5 |
|---|---|---|---|
${Object.entries(perCat).sort().map(([c, v]) => `| ${c} | ${v.n} | ${((v.r1 / v.n) * 100).toFixed(0)}% | ${((v.r5 / v.n) * 100).toFixed(0)}% |`).join("\n")}
`;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md);
  console.log(md);
  if (!existsSync(outPath)) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });

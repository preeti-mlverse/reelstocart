# Retrieval evaluation (visual stage)

_Generated 2026-11-13T20:10:17.866Z by `services/search/scripts/eval_retrieval.ts`._

**Setup.** 56 real catalogue products (non-fixture, with embeddings). Each product photo is turned into a
reel-style screenshot (9:16 frame, random 82–95% off-centre crop, blurred fill, UI bars, JPEG q=70), embedded with
the production FashionCLIP model, and queried with the production pgvector ANN query (category-filtered, co-ord aware).
No LLM calls; this isolates visual retrieval. Caveat: the query photo is derived from the catalogue photo, so this
measures robustness to screenshot framing/compression, **not** cross-photo (street → studio) matching.

| Metric | Value |
|---|---|
| Queries | 56 |
| Recall@1 | 100.0% |
| Recall@5 | 100.0% |
| MRR | 1.000 |
| True-product visual sim (p5 / median) | 0.917 / 0.947 |
| Best *other* product sim (median / p98) | 0.807 / 0.906 |
| Gap true − best other (p5 / median) | 0.048 / 0.147 |
| Suggested near-duplicate threshold (p98 of best-other) | 0.906 → covers 98% of true matches |

## Per category
| Category | n | R@1 | R@5 |
|---|---|---|---|
| blazer | 4 | 100% | 100% |
| co_ord_set | 3 | 100% | 100% |
| dress | 7 | 100% | 100% |
| jacket | 8 | 100% | 100% |
| jeans | 6 | 100% | 100% |
| shirt | 7 | 100% | 100% |
| skirt | 7 | 100% | 100% |
| top | 6 | 100% | 100% |
| trousers | 8 | 100% | 100% |

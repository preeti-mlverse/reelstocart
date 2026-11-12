# Model Evaluation Strategy

> No fabricated scores. Tables below are **empty placeholders** to be filled by running the benchmark harness (Phase 13). "TBD" means not yet measured.

## Benchmark set
≥300 labelled examples as data becomes available: clean product shots, celebrity/TV/web-series frames, IG-style screenshots, uploaded short videos, multi-person/multi-outfit scenes, occlusion, poor lighting, similar-colour-different-cut, and known no-match cases.

## Metrics
Garment detection P/R · attribute accuracy · Recall@20 · Precision@5 · NDCG@5 · no-match detection quality · availability freshness · p50/p95 latency · cost/search.

## Pipelines compared
- **A** Hosted VLM only (Gemini structured detection → attribute match)
- **B** VLM + garment segmentation (detect/crop then analyse)
- **C** Hybrid retrieval, no reranker
- **D** Hybrid retrieval + VLM reranker

## Candidate models
| Role | Candidates | Decision |
|------|-----------|----------|
| VLM (detect+attrs) | gemini-3.5-flash-lite (default), Qwen3-VL (open-weight) | TBD by benchmark |
| Visual embedding | **FashionCLIP (integrated, 512-d)**, SigLIP 2 (to benchmark) | FashionCLIP live; SigLIP TBD |
| Detector/segmenter | VLM-structured, GroundingDINO+SAM2, SAM3 (if licensed) | per-media |

## Results (to be populated)
| Pipeline | P@5 | R@20 | NDCG@5 | no-match F1 | p95 ms | $/search |
|----------|-----|------|--------|-------------|--------|----------|
| A | TBD | TBD | TBD | TBD | TBD | TBD |
| B | TBD | TBD | TBD | TBD | TBD | TBD |
| C | TBD | TBD | TBD | TBD | TBD | TBD |
| D | TBD | TBD | TBD | TBD | TBD | TBD |

The winning path is chosen from this table, not from demo impressions.

## Integration notes (2026-11-12)
- **FashionCLIP** (`patrickjohncyh/fashion-clip`, CLIP ViT-B/32, 512-d) is wired as the visual embedder in `services/vision/app/embedder.py` (swappable; `build_embedder` falls back to a mock, loudly). Garment crops are embedded in the analyze path; `services/search/src/hybrid.ts` fuses visual cosine with attribute agreement.
- Verified: query dress → top visual neighbours are all dresses (type clustering works). **Caveat:** the seed catalogue uses *synthetic silhouette* images, so colour discrimination in the visual signal is weak (crimson≈red≈maroon at cos ~0.80); the attribute matcher corrects colour, and real product photos will sharpen the visual axis. This is why the benchmark must run on real images before trusting Recall@20/NDCG.

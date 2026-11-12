# Architecture

## 1. System overview

Reel-to-Cart is a modular pipeline: **ingest media → understand video → detect garments → extract attributes → retrieve candidates → rerank → compose outfit → shop**. Each stage is a replaceable provider behind a typed interface so models/vendors can be swapped without touching callers.

```
                 ┌─────────────────────────────────────────────────────────┐
  User (web/mob) │                   apps/web (Next.js)                     │
        │        │  UI screens + API routes (auth, rate-limit, orchestrate) │
        ▼        └───────────────┬─────────────────────────────┬───────────┘
  Paste link / upload            │ enqueue job                 │ query
                                 ▼                             ▼
                        services/workers ───────────► services/search
                        (Redis queue)                 (hybrid retrieval
                                 │                      + VLM rerank)
          ┌──────────────────────┼───────────────┐           │
          ▼                      ▼               ▼            ▼
   services/vision        packages/shared   object store   Postgres
   (FastAPI CV)           media adapters    (MinIO/S3)     + pgvector
   frame extraction       SSRF-safe fetch                  catalogue +
   garment detection      status machine                   embeddings
   attribute VLM
```

## 2. Data flow (one search)

1. **Submit** — user pastes a URL or uploads a file. `apps/web` creates a `SearchJob` (status `VALIDATING`).
2. **Resolve** — the correct `MediaSourceAdapter` validates/normalizes the URL (SSRF-guarded) or verifies the upload's real MIME/signature. Capabilities decide the path:
   - uploaded media / direct image → `MEDIA_ACCESSIBLE` → process.
   - social URL with media rights → `MEDIA_ACCESSIBLE`.
   - social URL, display-only → `PREVIEW_ONLY` → show embed, request `UPLOAD_REQUIRED` fallback.
3. **Video understanding** (`services/vision`) — scene-change-aware sampling, outfit grouping, person tracking, dedup, quality filter. Emits outfits with representative frames.
4. **User selection** — UI shows detected outfits/people; user picks the intended one (prevents matching the wrong person).
5. **Garment detection + segmentation** — strategy-pluggable (VLM / GroundingDINO+SAM2 / SAM3). Returns typed garments with boxes/masks/confidence.
6. **Attribute extraction** — versioned taxonomy, strict JSON, with evidence/confidence/unknown flags. Visible vs inferred vs merchant-verified kept separate.
7. **Retrieval** (`services/search`) — hybrid: visual (SigLIP/FashionCLIP embeddings via pgvector) + text semantic + BM25 + structured filters. Yields 100–300 candidates per garment.
8. **Rerank** — two-stage; detailed multimodal comparison with per-attribute agreement, hard-mismatch penalties. Buckets: `EXACT_VERIFIED` / `VERY_CLOSE` / `SIMILAR` / `STYLE_ALTERNATIVE` / `NO_RELIABLE_MATCH`.
9. **Outfit composition** — beam search over shortlists under a budget + coherence constraints.
10. **Present & shop** — product cards with real merchant data, match explanations, affiliate links; save/compare.

Every stage records cost + latency to the observability tables (Phase 12/14).

## 3. Key design decisions

- **Monorepo (pnpm workspaces).** Shared types flow end-to-end; `@rtc/schemas` is the single source of truth (Zod → inferred TS types → SQL kept in lockstep).
- **CV in Python (FastAPI), product/app logic in TS.** CV ecosystem (OpenCV, torch, SAM) is Python-native; the web/commerce layer is TS. They talk over a typed HTTP contract.
- **Provider/adapter pattern everywhere** (media sources, detectors, embedders, VLMs, merchants). A `ModelRegistry` records version/licence/cost/latency/benchmark per model.
- **Status machine** instead of boolean flags, so "we only had an embed, not the video" is never misreported as "analysed".
- **pgvector over a separate vector DB** for v1: one datastore, transactional consistency between products and embeddings, good enough to ~1M vectors. Revisit (Qdrant/pg at scale) per the benchmark.
- **Fail loud.** Missing credentials / empty catalogue / expired data / budget hit → explicit error states, never silent mock substitution.

## 4. Scaling path

- Workers scale horizontally off the Redis queue; vision is stateless and GPU-poolable.
- pgvector HNSW indexes per (model_id, image_role). Candidate pool size is configurable.
- Read replicas for catalogue; price/stock refresh on independent schedules.
- Future: footwear/bags/jewellery/men's are new taxonomy branches + catalogue categories, no pipeline rewrite.

See [DATAFLOW.md](DATAFLOW.md) for the diagram, [TECH_DECISIONS.md](TECH_DECISIONS.md) for the ADR, and [API_CONTRACTS.md](API_CONTRACTS.md) for interfaces.

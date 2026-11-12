# Implementation Status

Legend: ✅ done & runnable · 🟡 partial/scaffold · ⛔ BLOCKED (needs credential/licence/data) · ⬜ not started

_Last updated: 2026-11-12_

| Phase | Area | Status | Notes |
|------:|------|:------:|-------|
| 0 | Audit + architecture docs + `.env.example` | ✅ | This repo's `docs/`. |
| 1 | Monorepo, config, logging, infra compose, migrations | ✅ | pnpm workspace; Postgres+pgvector/Redis/MinIO compose. |
| 1 | Auth (guest/user/admin RBAC) | 🟡 | Role model + rate-limit scaffold; Google OAuth wiring pending. |
| 2 | Media ingestion engine (adapters, SSRF, status machine) | ✅ | TS, unit-tested. IG/YT = metadata/embed + upload fallback. |
| 3 | Video understanding (scene sampling, outfit grouping) | ✅ | OpenCV adaptive sampling (scene-change + sharpness + dedup); `/v1/analyze/video` returns deduped outfits w/ representative thumbnails; web UI outfit-selection flow. Verified on a 2-scene clip → 2 distinct outfits. Person-tracking across frames still heuristic. |
| 4 | Garment detection/segmentation | 🟡 | **Strategy A (Gemini VLM) implemented & live.** GroundingDINO+SAM2 / SAM3 = registry stubs ⛔ (weights). |
| 5 | Fashion attribute taxonomy + extraction | ✅ | Versioned taxonomy + strict JSON via Gemini; evidence/confidence/unknown. |
| 6 | Catalogue engine | ✅ | **CSV/JSON importer live & verified**: parse → taxonomy-normalize → validate (bad rows logged) → dedupe → idempotent DB upsert (products/variants/images/inventory/price-history) → catalogue_import bookkeeping → optional prune (deleted-product handling) → embed imported → searchable via pgvector. CLI `import.ts`. Shopify/Woo adapters = ⛔ (merchant auth). |
| 7 | Visual search index (embeddings, pgvector) | ✅ | **FashionCLIP (512-d) + pgvector HNSW live & verified**: `/v1/embed/image`, per-garment crop embeddings, 24 products+embeddings loaded into Postgres, ANN cosine query correct, HNSW index confirmed usable. Web retrieves via pgvector (`USE_PGVECTOR=true`) with in-process fallback. SigLIP 2 benchmark = ⬜. |
| 8 | Reranking (two-stage, match buckets) | ✅ | Two-stage: attribute candidates → **hybrid fuse (visual ⊕ attribute)** + hard-mismatch penalties + buckets. Verified end-to-end. Dedicated VLM reranker = optional ⬜. |
| 9 | Outfit composition (budget beam search) | 🟡 | Composer scaffold over shortlists. |
| 10 | Consumer UI | 🟡 | Upload → detect → match flow (minimal). Full screen set pending. |
| 11 | Commerce / affiliate tracking | ⬜ | Link-out + impression/click schema defined. |
| 12 | Admin dashboard | ⬜ | Tables defined; UI pending. |
| 13 | Evaluation harness | 🟡 | Structure + empty benchmark tables; no fabricated scores. |
| 14 | Perf/security/deploy | 🟡 | SSRF, retention, health checks, modes in place; DLQ/backups pending. |

## Minimal prototype (this session's goal) — ✅ VERIFIED
End-to-end **working and tested** on 2026-11-12:
- 46 TypeScript unit tests pass (SSRF, file-signature, media adapters, matcher, composer).
- Real Gemini (`gemini-3.5-flash-lite`) garment+attribute detection verified on a test image → correct `dress / red / a_line / sleeveless / boat / knee` with confidence+evidence flags.
- Vision FastAPI service verified over HTTP (`/healthz`, `/v1/analyze/image`).
- Full chain verified through the Next.js API route: upload → `/api/analyze` → vision → matcher → ranked product cards, with price filter and `VERY_CLOSE`/`SIMILAR`/`NO_RELIABLE_MATCH` labels + explanations.
- `next build` passes; `docker-compose.yml` + Dockerfiles ready for the VPS.

Run locally: `python services/vision/run_local.py` (loads `.env`, starts vision on :8000), then `pnpm --filter web dev` (:3000). Tests: `npx vitest run`.

## BLOCKED items & why
- **Real merchant catalogues (Shopify/Woo/APIs):** need merchant authorisation + feed URLs. Seed catalogue used meanwhile; importer ready.
- **Local open-weight CV (SAM2/SAM3/GroundingDINO, SigLIP/FashionCLIP self-host):** need model weights + (ideally) GPU. VPS has none → hosted path.
- **Social media frame extraction:** only where official API/licence permits; otherwise embed + upload fallback (implemented).

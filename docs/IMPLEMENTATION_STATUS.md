# Implementation Status

Legend: ✅ done & runnable · 🟡 partial/scaffold · ⛔ BLOCKED (needs credential/licence/data) · ⬜ not started

_Last updated: 2026-11-14_

| Phase | Area | Status | Notes |
|------:|------|:------:|-------|
| 0 | Audit + architecture docs + `.env.example` | ✅ | This repo's `docs/`. |
| 1 | Monorepo, config, logging, infra compose, migrations | ✅ | pnpm workspace; Postgres+pgvector/Redis/MinIO compose. |
| 1 | Auth (guest/user/admin RBAC) | 🟡 | Admin area behind HTTP Basic (`ADMIN_PASSWORD`, disabled if unset). Per-IP rate limits on analyze routes. Google OAuth for end users still pending (needs redirect URI on the live domain). |
| 2 | Media ingestion engine (adapters, SSRF, status machine) | ✅ | TS, unit-tested. IG/YT = metadata/embed + upload fallback. |
| 3 | Video understanding (scene sampling, outfit grouping) | ✅ | OpenCV adaptive sampling (scene-change + sharpness + dedup); `/v1/analyze/video` returns deduped outfits w/ representative thumbnails; web UI outfit-selection flow. Verified on a 2-scene clip → 2 distinct outfits. Person-tracking across frames still heuristic. |
| 4 | Garment detection/segmentation | 🟡 | **Strategy A (Gemini VLM) implemented & live.** GroundingDINO+SAM2 / SAM3 = registry stubs ⛔ (weights). |
| 5 | Fashion attribute taxonomy + extraction | ✅ | Versioned taxonomy + strict JSON via Gemini; evidence/confidence/unknown. |
| 6 | Catalogue engine | ✅ | **CSV/JSON importer live & verified**: parse → taxonomy-normalize → validate (bad rows logged) → dedupe → idempotent DB upsert (products/variants/images/inventory/price-history) → catalogue_import bookkeeping → optional prune (deleted-product handling) → embed imported → searchable via pgvector. CLI `import.ts`. Shopify/Woo adapters = ⛔ (merchant auth). |
| 7 | Visual search index (embeddings, pgvector) | ✅ | **FashionCLIP (512-d) + pgvector HNSW live & verified**: `/v1/embed/image`, per-garment crop embeddings, 24 products+embeddings loaded into Postgres, ANN cosine query correct, HNSW index confirmed usable. Web retrieves via pgvector (`USE_PGVECTOR=true`) with in-process fallback. SigLIP 2 benchmark = ⬜. |
| 8 | Reranking (two-stage, match buckets) | ✅ | Hybrid fuse (visual ⊕ attribute) with **coverage-weighted attributes**, **colour families**, **co-ord ↔ top/bottom compatibility**, calibrated **near-duplicate** rule (FashionCLIP ≥ 0.91 ⇒ VERY_CLOSE) and an evidence floor. Verified on real products (`docs/eval/real-products-2026-11-14.md`). Dedicated VLM reranker = optional ⬜. |
| 9 | Outfit composition (budget beam search) | ✅ | Wired into `/api/analyze` (`budget_inr`) + UI "Complete look within ₹X" panel; a co-ord filling two slots is charged once; missing slots reported honestly. Verified live. |
| 10 | Consumer UI | ✅ | Header/footer nav, home (finder + how-it-works + FAQ), `/shop`, 9 category pages (paginated), product pages with visually-similar grid, how-it-works, privacy/terms drafts, 404. Saved looks / accounts pending OAuth. |
| 11 | Commerce / affiliate tracking | ✅ | Every search logs a `search_job` + `ai_op_cost`; top results log `impression` events; outbound links go via `/go/<id>` (click logged, UTM appended, no open redirect, `rel=sponsored nofollow`). Affiliate network tags ⛔ until programmes are signed. |
| 12 | Admin dashboard | ✅ | `/admin`: products/embeddings, merchants, recent imports + row errors, searches 24h/7d, impressions/clicks/CTR, top clicked products, AI cost by stage/model. Read-only (no catalogue editing UI yet). |
| 13 | Evaluation harness | 🟡 | **Retrieval eval live** (`services/search/scripts/eval_retrieval.ts`): 56 real products as reel-style screenshots → Recall@1 100%, used to calibrate thresholds (`docs/eval/retrieval-latest.md`). Cross-photo (street → studio) labelled benchmark still needed. |
| 14 | Perf/security/deploy | 🟡 | SSRF, security headers (HSTS, nosniff, frame-deny, permissions), per-IP rate limits, `/api/health` (DB + vision), noindex on non-prod. DLQ/backups pending. |

## Minimal prototype (this session's goal) — ✅ VERIFIED
End-to-end **working and tested** on 2026-11-12:
- 46 TypeScript unit tests pass (SSRF, file-signature, media adapters, matcher, composer).
- Real Gemini (`gemini-3.5-flash-lite`) garment+attribute detection verified on a test image → correct `dress / red / a_line / sleeveless / boat / knee` with confidence+evidence flags.
- Vision FastAPI service verified over HTTP (`/healthz`, `/v1/analyze/image`).
- Full chain verified through the Next.js API route: upload → `/api/analyze` → vision → matcher → ranked product cards, with price filter and `VERY_CLOSE`/`SIMILAR`/`NO_RELIABLE_MATCH` labels + explanations.
- `next build` passes; `docker-compose.yml` + Dockerfiles ready for the VPS.

Run locally: `python services/vision/run_local.py` (loads `.env`, starts vision on :8000), then `pnpm --filter web dev` (web reads `apps/web/.env.local`; use port 3100 on this machine). Tests: `npx vitest run` (69). Retrieval eval: `DATABASE_URL=... npx tsx services/search/scripts/eval_retrieval.ts`.

## SEO (2026-11-14) — ✅
Full technical SEO in `apps/web`: env-gated indexing, canonical + hreflang, OG/Twitter + generated OG image, JSON-LD
(Organization, WebSite, WebApplication, HowTo, FAQPage, BreadcrumbList, ItemList, Product/Offer), dynamic sitemap,
robots, manifest, crawlable category/product pages. Details + go-live checklist: `docs/SEO.md`.

## BLOCKED items & why
- **Real merchant catalogues (Shopify/Woo/APIs):** need merchant authorisation + feed URLs. Seed catalogue used meanwhile; importer ready.
- **Local open-weight CV (SAM2/SAM3/GroundingDINO, SigLIP/FashionCLIP self-host):** need model weights + (ideally) GPU. VPS has none → hosted path.
- **Social media frame extraction:** only where official API/licence permits; otherwise embed + upload fallback (implemented).

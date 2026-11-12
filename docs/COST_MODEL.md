# Cost Model

Every expensive AI op is metered (model, tokens/images, latency, USD) and attributed to a `SearchJob`. Hard ceilings in `.env` act as circuit breakers.

## Estimated variable cost per search (DEVELOPMENT estimate — confirm against live billing)

| Stage | Model (default) | Unit | Est. USD |
|-------|-----------------|------|---------:|
| Garment detect + attributes (image) | gemini-3.5-flash-lite | 1 image + ~800 out tokens | ~0.0005–0.002 |
| Video frame analysis | gemini-flash-lite × N frames | 6–12 frames | ~0.004–0.02 |
| Text embedding (query) | text-embedding-3-small | ~1 call | ~0.00002 |
| Visual embedding | SigLIP (self-host) | GPU/CPU | ~0 marginal |
| Rerank (top-K multimodal) | gemini-flash-lite | 1 call/compare batch | ~0.001–0.005 |
| Retrieval (pgvector) | — | DB | negligible |

**Image-only search (acceptance scenario 1): ~US$0.001–0.01.**
**Short video search: ~US$0.01–0.04** depending on frame count.

> These are modelled estimates, not billed figures. The cost meter records actuals; the admin cost dashboard (Phase 12) reports p50/p95 cost per search.

## Controls
- `COST_PER_SEARCH_CEILING_USD` — a single search that would exceed this is halted with a clear error.
- `COST_MONTHLY_BUDGET_USD` + `COST_ALERT_THRESHOLD_PCT` — alert, then circuit-break hosted calls; degrade to `DEVELOPMENT_MOCK`/`REAL_LOCAL` with a visible banner (never silently fake results).
- Prototype policy: single minimal calls, no retry storms, cache analysis per `mediaId`.

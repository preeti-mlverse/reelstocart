# Reel-to-Cart

AI-powered fashion discovery for the Indian market. Paste an Instagram Reel / YouTube Short link, or upload a screenshot or short video → detect the outfit → find exact or closest products from authorised brand catalogues → recreate the full look within a budget.

> **Status:** Foundation (Phases 0–2) implemented and runnable. Later phases are scaffolded with explicit `BLOCKED` / `TODO` markers where they depend on model weights, catalogue licences, or API credentials. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Product principles (non-negotiable)

- **Accuracy over volume.** Fewer, correct results beat many wrong ones.
- **Never fabricate** products, prices, inventory, merchants, or shopping URLs.
- **Distinguish** exact verified matches from visually-similar alternatives.
- **Respect platforms.** No scraping, no auth/DRM/rate-limit bypass. Social links are accepted as input, but media is processed only when the API/licence/terms permit it; otherwise we fall back to user upload.
- **Observable & budgeted.** Every expensive AI op is metered and circuit-broken.

## Monorepo layout

```
apps/web/          Next.js + React + TS consumer app & API routes
services/vision/   FastAPI CV service (frame extraction, garment detection)
services/catalog/  Catalogue ingestion (CSV/JSON/Shopify/Woo) — scaffold
services/search/   Hybrid retrieval + reranking — scaffold
services/workers/  Background jobs (Redis-backed) — scaffold
packages/schemas/  Zod schemas, DB schema (SQL), taxonomy
packages/shared/   Config, logging, SSRF-safe fetch, media adapters, status codes
packages/ui/       Shared React components / design tokens — scaffold
infra/             docker-compose (Postgres+pgvector, Redis, MinIO)
tests/             Cross-cutting integration tests
docs/              Architecture, contracts, security, cost, evaluation
```

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm run infra:up        # Postgres(pgvector) + Redis + MinIO
pnpm run db:migrate
pnpm --filter @rtc/vision dev   # FastAPI on :8000  (needs Python 3.12 + venv)
pnpm --filter web dev           # Next.js on :3000
```

Run the media-engine test suite (no infra needed):

```bash
pnpm --filter @rtc/shared test
```

## Runtime modes

`RTC_MODE` selects behaviour and fails loudly rather than hiding mocks behind a real UI:

| Mode | Models | External spend | Use |
|------|--------|----------------|-----|
| `DEVELOPMENT_MOCK` | deterministic fakes | none | local dev, CI |
| `REAL_LOCAL` | open-weight (CPU/GPU) | none | self-hosted |
| `REAL_HOSTED` | hosted APIs | yes (budget-capped) | production |

## Docs

[Architecture](docs/ARCHITECTURE.md) · [API Contracts](docs/API_CONTRACTS.md) · [Security](docs/SECURITY.md) · [Cost Model](docs/COST_MODEL.md) · [Model Evaluation](docs/MODEL_EVALUATION.md) · [Deployment](docs/DEPLOYMENT.md) · [Status](docs/IMPLEMENTATION_STATUS.md)

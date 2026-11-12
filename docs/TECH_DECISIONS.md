# Technology Decision Record (ADR)

Format: decision · status · rationale · alternatives · revisit trigger.

### ADR-001 — pnpm monorepo
**Accepted.** Shared schemas/types across web + services; fast, disk-efficient installs; workspace protocol for internal packages. *Alt:* Nx/Turborepo (more tooling than needed now), polyrepo (type drift). *Revisit:* if build graph needs caching → add Turborepo.

### ADR-002 — Next.js for web + API
**Accepted.** One framework for SSR UI + API routes; good mobile-first DX; Vercel-friendly but self-hostable. *Alt:* separate React SPA + Express. *Revisit:* if API surface outgrows route handlers → extract a Nest/Fastify gateway.

### ADR-003 — Python FastAPI for the vision service
**Accepted.** CV/ML is Python-native (OpenCV, torch, ultralytics, SAM, transformers). FastAPI gives typed, async HTTP. *Alt:* ONNX-in-Node (immature for SAM/VLM). *Revisit:* never, for CV.

### ADR-004 — Postgres + pgvector as the single datastore
**Accepted.** Transactional consistency between products, inventory, and embeddings; HNSW ANN; one thing to operate. *Alt:* Qdrant/Weaviate/Milvus (another service, eventual consistency). *Revisit:* > ~1–2M vectors or recall/latency regressions → dedicated vector DB.

### ADR-005 — Redis for queues, rate limits, cache
**Accepted.** Simple, ubiquitous; BullMQ-compatible. *Alt:* SQS/Kafka (ops heavy for v1). *Revisit:* multi-region or durable event log needs.

### ADR-006 — Zod as schema source of truth
**Accepted.** Runtime validation + inferred static types; shared between web and workers. SQL migrations hand-written to match. *Alt:* Prisma (great DX, but pgvector support is awkward) — may adopt Prisma for CRUD while keeping raw SQL for vector ops. *Revisit:* Phase 6.

### ADR-007 — Object storage via adapter (local → MinIO → S3)
**Accepted.** Private buckets, signed URLs, auto-expiry. Local filesystem adapter for zero-dep dev. *Revisit:* CDN for product images.

### ADR-008 — Runtime mode tri-state (MOCK/LOCAL/HOSTED)
**Accepted.** Prevents hidden mocks in prod and uncontrolled spend. Enforced centrally in `@rtc/shared/config`. *Revisit:* never.

### ADR-009 — Embeddings: benchmark SigLIP 2 vs FashionCLIP
**Open / pending benchmark.** Default to SigLIP 2 (strong general fashion), keep FashionCLIP as a candidate. Decided by the Phase 13 benchmark, not vibes. See [MODEL_EVALUATION.md](MODEL_EVALUATION.md).

### ADR-010 — Garment detection strategy is per-media, not global
**Accepted.** VLM structured detection (cheap, fast, hosted) for clean images; GroundingDINO+SAM2 for precise masks; SAM3 if licence/runtime permit. Chosen per input via registry + heuristics.

### ADR-011 — Social media: input-accept but process-only-if-permitted
**Accepted (compliance-critical).** IG/YT URLs are valid inputs; automatic frame extraction only where API/licence/terms allow, else embed + upload fallback. No unofficial scraping, no anti-bot bypass. oEmbed used for display only, never to derive outfit metadata.

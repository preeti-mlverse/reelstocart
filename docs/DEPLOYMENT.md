# Deployment

## Local development
```bash
cp .env.example .env            # then fill values
pnpm install
pnpm run infra:up               # Postgres+pgvector, Redis, MinIO via docker compose
pnpm run db:migrate
# vision service (Python 3.12):
python -m venv services/vision/.venv
services/vision/.venv/Scripts/pip install -r services/vision/requirements.txt   # Windows
services/vision/.venv/Scripts/python -m uvicorn app.main:app --port 8000
# web:
pnpm --filter web dev
```

## Environments
`RTC_MODE` = `DEVELOPMENT_MOCK` | `REAL_LOCAL` | `REAL_HOSTED`. The app **fails loudly** (startup check + health endpoint) if a mode's prerequisites are missing — e.g. `REAL_HOSTED` with no `GEMINI_API_KEY`. It never silently serves mock data behind a real UI.

## Containers
Each service ships a Dockerfile; `infra/docker-compose.yml` wires them for local. Production: build images in CI, deploy to a container host (ECS/Fly/Render/K8s). Vision service wants a GPU node in `REAL_LOCAL`; CPU works for the Gemini-hosted path.

## Operational requirements (Phase 14)
- DB backups (pg_dump schedule), PITR where supported.
- Health checks `/healthz` per service; readiness gates migrations.
- Structured JSON logs → aggregator; metrics (cost, latency, queue depth).
- Job idempotency keys; retry/backoff; dead-letter queue for poison jobs.
- Rate limiting + abuse prevention at the edge.
- Media retention sweeper (cron) honouring `MEDIA_RETENTION_SECONDS`.

## Target: Hostinger VPS
- **Ubuntu 26.04 LTS, KVM 2, 100 GB disk, no GPU.** Docker + Docker Manager available.
- No GPU → run vision in `REAL_HOSTED` mode (Gemini path), not `REAL_LOCAL` GPU models.
- Plan: build & verify locally → push repo to VPS → `docker compose -f infra/docker-compose.yml up -d` with a production `.env` (secrets set on the box, never committed) → reverse-proxy (Caddy/Nginx) with TLS in front of `apps/web`.
- Keep Postgres/Redis/MinIO as compose services or managed; set `MEDIA_RETENTION_SECONDS` and backups.

## Fail-clear conditions
Startup/health reports FAILED (not degraded-silent) when: model credentials absent for the mode, media access prohibited, product catalogue empty, search index unavailable, product data expired, or budget limits reached.

# Data-flow diagram

```
┌──────────────┐   paste URL / upload file
│    Client    │────────────────────────────────┐
└──────────────┘                                 ▼
                                   ┌──────────────────────────────┐
                                   │ apps/web  POST /api/search    │
                                   │  authn · rate-limit · create  │
                                   │  SearchJob(status=VALIDATING) │
                                   └───────────────┬──────────────┘
                                                   ▼
                            ┌──────────────────────────────────────┐
                            │ @rtc/shared  MediaSourceAdapter        │
                            │  validateUrl → SSRF guard              │
                            │  checkAccess → capabilities            │
                            └───┬───────────────┬──────────────┬────┘
            MEDIA_ACCESSIBLE    │   PREVIEW_ONLY │    UPLOAD_REQUIRED
                                ▼               ▼              ▼
                     ┌────────────────┐  show embed +   ask user to
                     │ enqueue job    │  reference URL   upload frames
                     │ (Redis)        │  (no media claim)
                     └───────┬────────┘
                             ▼
                  ┌────────────────────┐   frames    ┌───────────────────┐
                  │ services/workers   │────────────►│ services/vision    │
                  │ orchestration      │◄────────────│ FastAPI CV         │
                  └───────┬────────────┘   outfits   │  sample · group ·  │
                          │  garments+attrs          │  detect · attrs    │
                          ▼                          └───────────────────┘
                 ┌─────────────────┐  filters+embeds  ┌──────────────────┐
                 │ services/search │─────────────────►│ Postgres+pgvector │
                 │ hybrid retrieve │◄─────────────────│ products/embeds   │
                 │ + VLM rerank    │   candidates     └──────────────────┘
                 └───────┬─────────┘
                         ▼
                 ┌─────────────────┐
                 │ outfit composer │  beam search under budget
                 └───────┬─────────┘
                         ▼
                 ┌─────────────────┐   match labels + explanations + merchant links
                 │  apps/web  UI   │   save · compare · shop (affiliate)
                 └─────────────────┘

Cross-cutting (all stages):  structured logs · cost meter · latency · audit log · media auto-expiry
```

## Trust boundaries

- **Untrusted inbound:** user URLs and uploads. Validated at the adapter boundary (SSRF, MIME signature, size/dim/duration caps, decompression-bomb guard). Stored private; served via signed URLs.
- **Third-party outbound:** merchant feeds/APIs, social oEmbed, hosted model APIs. Allowlisted hosts; no user PII in outbound requests.
- **Internal:** web ↔ vision ↔ search over private network with typed contracts.

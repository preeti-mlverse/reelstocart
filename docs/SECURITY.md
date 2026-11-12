# Security & Content-Retention Policy

## Secrets
- All credentials via environment only. `.env` is gitignored; `.env.example` holds placeholders only.
- Never logged, never in URLs/query strings, never in error messages or outbound third-party requests.
- No user PII (incl. the account email) sent to external services without explicit user approval.

## Media ingestion (untrusted input)
- **SSRF defence:** URL scheme allowlist (`https` only for remote; `http` only for configured localhost dev); host allowlist per provider; reject private/loopback/link-local/CGNAT ranges (10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, ::1, fc00::/7, etc.) and `*.local`. Resolve DNS and re-check the resolved IP; block redirects to private ranges.
- **File validation:** verify real MIME via magic-byte signature, not extension/`Content-Type`. Allowlist jpeg/png/webp/heic, mp4/mov/webm.
- **Limits:** max upload bytes, max video duration, max image dimension, max frame count — all enforced before decode to stop **decompression bombs**.
- **No execution:** uploaded content is never executed; images decoded in a sandboxed worker; optional AV scan hook.
- **Storage:** private buckets only, signed URLs with short TTL, server-side encryption.

## Social platform compliance
- Links accepted as input; automatic media extraction only when the provider's official API/licence/terms permit it.
- No unofficial scraping, no anti-bot / DRM / rate-limit / auth bypass.
- oEmbed is for display only — never mined for outfit metadata.
- When media isn't permitted: show embed + offer upload fallback; never claim the video was analysed.

## AuthZ / AuthN
- Single app auth system. Roles: `guest` (rate-limited search), `user`, `admin`. Configurable role→permission map.
- Session tokens signed with `AUTH_SECRET`; Google OAuth optional.

## Retention & user control
- Uploaded media auto-expires (`MEDIA_RETENTION_SECONDS`, default 24h) and is hard-deleted by a sweeper job.
- Users can delete their media/searches on demand; deletion requests tracked in an admin queue.
- Audit log for admin actions and deletions.

## Abuse & rate limiting
- Redis-backed per-identity limits (guest vs user). Upload throttles. Circuit breakers on cost.

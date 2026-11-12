# API Contracts

All payloads validated by Zod schemas in `@rtc/schemas`. Errors use a consistent envelope.

## Error envelope
```jsonc
{ "error": { "code": "MEDIA_PREVIEW_ONLY", "message": "...", "retriable": false, "details": {} } }
```

## Status codes (media/job state machine)
`VALIDATING · RESOLVING · MEDIA_ACCESSIBLE · PREVIEW_ONLY · UPLOAD_REQUIRED · PROCESSING · COMPLETE · FAILED · UNSUPPORTED`

## apps/web (public API)

### `POST /api/search`  — start a search
Body (one of):
```jsonc
{ "kind": "url", "url": "https://www.instagram.com/reel/XXXX/" }
{ "kind": "image_url", "url": "https://images.example.com/a.jpg" }
// uploads go via POST /api/upload (multipart) first, then:
{ "kind": "upload", "mediaId": "med_123" }
```
Response:
```jsonc
{ "jobId": "job_123", "status": "RESOLVING", "capabilities": {...}, "preview": {...} }
```

### `POST /api/upload` — multipart file upload
Returns `{ "mediaId": "med_123", "status": "MEDIA_ACCESSIBLE", "kind": "image|video" }` after MIME/signature + size validation. Stored private.

### `GET /api/jobs/:id` — poll job
```jsonc
{ "jobId":"job_123","status":"COMPLETE","outfits":[...],"garments":[...] }
```

### `POST /api/search/:jobId/match` — run matching for a selected garment
```jsonc
{ "garmentId":"g1", "filters": { "maxPriceInr": 3000, "sizes":["M"], "merchants":[] } }
```
Response: ranked products with `matchLabel` ∈ {EXACT_VERIFIED, VERY_CLOSE, SIMILAR, STYLE_ALTERNATIVE, NO_RELIABLE_MATCH}, `score`, `explanation.similarities[]`, `explanation.differences[]`.

### `POST /api/outfit/compose` — budget outfit recreation
```jsonc
{ "jobId":"job_123","budgetInr":3000,"essential":["top"] }
```
Returns `{ closest, budgetFriendly, alternative }`, each a coherent set with `totalInr`, `coverage`, `merchantCount`.

## services/vision (internal, FastAPI)

### `POST /v1/analyze/image`  (multipart or `{image_base64}`)
```jsonc
{
  "garments":[{
    "garment_id":"g1","category":"dress","bbox":[x,y,w,h],
    "confidence":0.82,"occlusion":false,
    "attributes":{ "primary_color":{"value":"black","confidence":0.9,"evidence":"visible","unknown":false}, ... }
  }],
  "model":{"name":"gemini-3.5-flash-lite","version":"...","mode":"REAL_HOSTED"},
  "cost_usd":0.0007,"latency_ms":1840
}
```

### `POST /v1/analyze/video`  (`{media_id}` or `{video_url}`)
Returns outfits (`outfit_id`, representative frame, timestamps, associated frames, detected people, candidate garments, image_quality, uncertainty).

### `GET /healthz` → `{ "status":"ok","mode":"...","models":[...] }`

## Provider interfaces (TypeScript, in `@rtc/shared`)

```ts
interface MediaSourceAdapter {
  key: string;
  validateUrl(url: string): ValidationResult;
  normalizeUrl(url: string): string;
  resolveMetadata(url: string): Promise<MediaMetadata>;
  checkAccess(url: string): Promise<AccessDecision>;   // -> capabilities + status
  getPermittedMedia(url: string): Promise<PermittedMedia>;
  getPreview(url: string): Promise<Preview>;
  getCapabilities(): ProviderCapabilities;
  returnFallbackInstructions(): FallbackInstructions;
}
```

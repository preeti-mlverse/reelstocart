import type {
  MediaSourceAdapter, ProviderCapabilities, MediaMetadata, AccessDecision,
  PermittedMedia, Preview, FallbackInstructions, ValidationResult,
} from "./types";
import { detectMediaType, ALLOWED_IMAGE_MIMES, ALLOWED_VIDEO_MIMES } from "../filesig";

export interface UploadLimits {
  maxUploadBytes: number;
  maxImageDimension: number;
  maxVideoDurationSeconds: number;
  maxVideoFrames: number;
}

export interface UploadCheck {
  ok: boolean;
  reason?: string;
  kind?: "image" | "video";
  mime?: string;
}

/**
 * Validate an uploaded buffer by MAGIC BYTES + size, before any decode.
 * Dimension/duration/frame caps are enforced by the vision service after a
 * guarded decode (guards decompression bombs).
 */
export function validateUpload(buf: Uint8Array, limits: UploadLimits): UploadCheck {
  if (buf.byteLength === 0) return { ok: false, reason: "empty_file" };
  if (buf.byteLength > limits.maxUploadBytes) return { ok: false, reason: "file_too_large" };
  const t = detectMediaType(buf);
  if (!t) return { ok: false, reason: "unsupported_or_spoofed_type" };
  if (t.kind === "image" && !ALLOWED_IMAGE_MIMES.includes(t.mime as any))
    return { ok: false, reason: "image_mime_not_allowed" };
  if (t.kind === "video" && !ALLOWED_VIDEO_MIMES.includes(t.mime as any))
    return { ok: false, reason: "video_mime_not_allowed" };
  return { ok: true, kind: t.kind, mime: t.mime };
}

/** Upload adapter — media is already in our private storage, so it's processable. */
export function createUploadAdapter(): MediaSourceAdapter {
  const caps: ProviderCapabilities = {
    metadataAvailable: true,
    embedAvailable: false,
    originalMediaProcessingPermitted: true,
    frameExtractionAvailable: true,
    accountAuthorisationRequired: false,
    sourceUnavailable: false,
  };
  return {
    key: "upload",
    validateUrl(ref): ValidationResult {
      // ref is an internal media id like "med_..." — not a web URL
      return /^med_[A-Za-z0-9_-]+$/.test(ref)
        ? { ok: true, normalized: ref }
        : { ok: false, reason: "not_a_media_id" };
    },
    normalizeUrl: (ref) => ref,
    async resolveMetadata(ref): Promise<MediaMetadata> {
      return { provider: "upload", originalUrl: ref };
    },
    async checkAccess(): Promise<AccessDecision> {
      return { status: "MEDIA_ACCESSIBLE", capabilities: caps };
    },
    async getPermittedMedia(ref): Promise<PermittedMedia> {
      // caller maps the media id to a signed URL / local path
      return { images: [ref], videos: [ref] };
    },
    async getPreview(): Promise<Preview> {
      return { type: "thumbnail" };
    },
    getCapabilities: () => caps,
    returnFallbackInstructions(): FallbackInstructions {
      return { required: false, message: "", acceptedUploads: [] };
    },
  };
}

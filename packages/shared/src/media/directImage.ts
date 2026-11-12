import type {
  MediaSourceAdapter, ProviderCapabilities, MediaMetadata, AccessDecision,
  PermittedMedia, Preview, FallbackInstructions, ValidationResult,
} from "./types";
import { validateRemoteUrl, type UrlPolicy } from "../ssrf";

/**
 * Direct image URL adapter — only for approved image hosts, SSRF-guarded.
 * The actual byte fetch (done by the caller) MUST re-check the resolved IP and
 * verify magic bytes (see filesig.ts) before decoding.
 */
export interface DirectImageOptions {
  /** approved image CDNs/hosts; empty allowlist = allow any public https host */
  hostAllowlist?: string[];
  allowLocalhost?: boolean;
}

export function createDirectImageAdapter(opts: DirectImageOptions = {}): MediaSourceAdapter {
  const policy: UrlPolicy = {
    schemes: ["https", ...(opts.allowLocalhost ? ["http"] : [])],
    allowLocalhost: !!opts.allowLocalhost,
    hostAllowlist: opts.hostAllowlist,
  };
  const caps: ProviderCapabilities = {
    metadataAvailable: true,
    embedAvailable: false,
    originalMediaProcessingPermitted: true,
    frameExtractionAvailable: false,
    accountAuthorisationRequired: false,
    sourceUnavailable: false,
  };
  const IMG_EXT = /\.(jpe?g|png|webp|heic|heif)(\?.*)?$/i;

  return {
    key: "direct_image",
    validateUrl(url): ValidationResult {
      const r = validateRemoteUrl(url, policy);
      if (!r.ok) return r;
      if (!IMG_EXT.test(new URL(r.normalized!).pathname) && !IMG_EXT.test(url)) {
        // allow extension-less CDN URLs; signature check happens at fetch time
      }
      return r;
    },
    normalizeUrl(url): string {
      return validateRemoteUrl(url, policy).normalized ?? url;
    },
    async resolveMetadata(url): Promise<MediaMetadata> {
      return { provider: "direct_image", originalUrl: this.normalizeUrl(url) };
    },
    async checkAccess(url): Promise<AccessDecision> {
      const r = validateRemoteUrl(url, policy);
      if (!r.ok) return { status: "UNSUPPORTED", capabilities: { ...caps, sourceUnavailable: true }, reason: r.reason };
      return { status: "MEDIA_ACCESSIBLE", capabilities: caps };
    },
    async getPermittedMedia(url): Promise<PermittedMedia> {
      return { images: [this.normalizeUrl(url)], videos: [] };
    },
    async getPreview(url): Promise<Preview> {
      return { type: "thumbnail", thumbnailUrl: this.normalizeUrl(url) };
    },
    getCapabilities: () => caps,
    returnFallbackInstructions(): FallbackInstructions {
      return { required: false, message: "", acceptedUploads: [] };
    },
  };
}

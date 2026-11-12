import type {
  MediaSourceAdapter, ProviderCapabilities, MediaMetadata, AccessDecision,
  PermittedMedia, Preview, FallbackInstructions, ValidationResult,
} from "./types";

/**
 * Instagram adapter.
 *
 * COMPLIANCE: we ACCEPT reel/post URLs as input, but we do NOT scrape and we do
 * NOT bypass auth/anti-bot. Without an approved API + media licence, Instagram is
 * PREVIEW_ONLY: we keep the URL as reference metadata and ask the user to upload a
 * screenshot/clip. oEmbed (if ever enabled) is for display only — never mined for
 * outfit attributes.
 */
const IG_HOST = /(^|\.)instagram\.com$/i;
const IG_PATH = /^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?/;

export interface InstagramOptions {
  oEmbedEnabled: boolean; // requires an approved app; display-only
}

export function createInstagramAdapter(opts: InstagramOptions): MediaSourceAdapter {
  const caps: ProviderCapabilities = {
    metadataAvailable: opts.oEmbedEnabled,
    embedAvailable: opts.oEmbedEnabled,
    originalMediaProcessingPermitted: false, // never, without explicit licence
    frameExtractionAvailable: false,
    accountAuthorisationRequired: false,
    sourceUnavailable: false,
  };

  return {
    key: "instagram",
    validateUrl(url): ValidationResult {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:") return { ok: false, reason: "scheme_not_allowed" };
        if (!IG_HOST.test(u.hostname)) return { ok: false, reason: "not_instagram_host" };
        if (!IG_PATH.test(u.pathname)) return { ok: false, reason: "not_a_reel_or_post" };
        return { ok: true, normalized: this.normalizeUrl(url) };
      } catch {
        return { ok: false, reason: "malformed_url" };
      }
    },
    normalizeUrl(url): string {
      const u = new URL(url);
      const m = u.pathname.match(IG_PATH);
      const kind = m?.[1] === "reels" ? "reel" : m?.[1];
      return `https://www.instagram.com/${kind}/${m?.[2]}/`;
    },
    async resolveMetadata(url): Promise<MediaMetadata> {
      return { provider: "instagram", originalUrl: this.normalizeUrl(url) };
    },
    async checkAccess(): Promise<AccessDecision> {
      // No approved media pipeline → preview/upload fallback.
      return {
        status: "PREVIEW_ONLY",
        capabilities: caps,
        reason: opts.oEmbedEnabled
          ? "embed_display_only_no_media_rights"
          : "no_approved_api_media_processing_not_permitted",
      };
    },
    async getPermittedMedia(): Promise<PermittedMedia> {
      return { images: [], videos: [] }; // nothing we may process
    },
    async getPreview(): Promise<Preview> {
      if (opts.oEmbedEnabled) {
        return { type: "embed_html", note: "Embedded for display only; the video itself was not analysed." };
      }
      return {
        type: "none",
        note: "Instagram media can't be processed automatically here. Upload a screenshot or clip to search the outfit.",
      };
    },
    getCapabilities: () => caps,
    returnFallbackInstructions(): FallbackInstructions {
      return {
        required: true,
        message:
          "We can't download this Instagram media. Take a screenshot of the outfit (or save a short clip) and upload it.",
        acceptedUploads: ["image", "video"],
      };
    },
  };
}

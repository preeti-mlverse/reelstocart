import type {
  MediaSourceAdapter, ProviderCapabilities, MediaMetadata, AccessDecision,
  PermittedMedia, Preview, FallbackInstructions, ValidationResult,
} from "./types";

/**
 * YouTube adapter (Shorts + regular).
 *
 * COMPLIANCE: oEmbed/Data API give metadata + an embeddable player for DISPLAY.
 * They do NOT grant rights to download the stream for frame extraction. So:
 *  - metadata/embed → yes (when enabled)
 *  - original media processing / frame extraction → no (upload fallback)
 * No stream ripping, no yt-dlp, no anti-bot bypass.
 */
const YT_HOSTS = /(^|\.)(youtube\.com|youtu\.be)$/i;

function extractId(u: URL): string | null {
  if (/youtu\.be$/i.test(u.hostname)) return u.pathname.slice(1).split("/")[0] || null;
  if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
  if (u.pathname === "/watch") return u.searchParams.get("v");
  if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
  return null;
}

export interface YouTubeOptions {
  oEmbedEnabled: boolean;
  apiKey?: string;
}

export function createYouTubeAdapter(opts: YouTubeOptions): MediaSourceAdapter {
  const caps: ProviderCapabilities = {
    metadataAvailable: opts.oEmbedEnabled || !!opts.apiKey,
    embedAvailable: opts.oEmbedEnabled,
    originalMediaProcessingPermitted: false,
    frameExtractionAvailable: false,
    accountAuthorisationRequired: false,
    sourceUnavailable: false,
  };

  return {
    key: "youtube",
    validateUrl(url): ValidationResult {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:") return { ok: false, reason: "scheme_not_allowed" };
        if (!YT_HOSTS.test(u.hostname)) return { ok: false, reason: "not_youtube_host" };
        if (!extractId(u)) return { ok: false, reason: "no_video_id" };
        return { ok: true, normalized: this.normalizeUrl(url) };
      } catch {
        return { ok: false, reason: "malformed_url" };
      }
    },
    normalizeUrl(url): string {
      const u = new URL(url);
      const id = extractId(u);
      const isShort = u.pathname.startsWith("/shorts/");
      return isShort ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
    },
    async resolveMetadata(url): Promise<MediaMetadata> {
      return { provider: "youtube", originalUrl: this.normalizeUrl(url) };
    },
    async checkAccess(): Promise<AccessDecision> {
      return {
        status: "PREVIEW_ONLY",
        capabilities: caps,
        reason: "embed_and_metadata_only_no_stream_download_rights",
      };
    },
    async getPermittedMedia(): Promise<PermittedMedia> {
      return { images: [], videos: [] };
    },
    async getPreview(url): Promise<Preview> {
      const u = new URL(this.normalizeUrl(url));
      const id = extractId(u);
      if (opts.oEmbedEnabled && id) {
        return {
          type: "embed_html",
          embedHtml: `<iframe src="https://www.youtube.com/embed/${id}" allowfullscreen loading="lazy"></iframe>`,
          note: "Player embedded for display only; frames were not extracted from the stream.",
        };
      }
      return {
        type: "none",
        note: "We can't extract frames from YouTube here. Upload a screenshot or a short clip of the outfit.",
      };
    },
    getCapabilities: () => caps,
    returnFallbackInstructions(): FallbackInstructions {
      return {
        required: true,
        message: "To search this outfit, upload a screenshot of the frame or a short clip you have the rights to.",
        acceptedUploads: ["image", "video"],
      };
    },
  };
}

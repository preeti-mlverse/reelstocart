import type { MediaStatus } from "@rtc/schemas";
export type { ValidationResult } from "../ssrf";

/** What a provider can actually do with a given input (Phase 2). */
export interface ProviderCapabilities {
  metadataAvailable: boolean;
  embedAvailable: boolean;
  /** original media may be fetched & processed (API/licence/terms permit it) */
  originalMediaProcessingPermitted: boolean;
  frameExtractionAvailable: boolean;
  accountAuthorisationRequired: boolean;
  sourceUnavailable: boolean;
}

export interface MediaMetadata {
  provider: string;
  originalUrl: string;
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
  /** kept as reference metadata only — never mined for outfit attributes */
  raw?: Record<string, unknown>;
}

export interface Preview {
  type: "embed_html" | "thumbnail" | "none";
  embedHtml?: string;
  thumbnailUrl?: string;
  /** honest note shown to the user about what is/ isn't possible */
  note?: string;
}

export interface FallbackInstructions {
  required: boolean;
  message: string;
  acceptedUploads: Array<"image" | "video">;
}

export interface PermittedMedia {
  /** media the provider is permitted to hand us for processing */
  images: string[];
  videos: string[];
  /** if empty and status is PREVIEW_ONLY, caller must use the fallback */
}

export interface AccessDecision {
  status: Extract<MediaStatus, "MEDIA_ACCESSIBLE" | "PREVIEW_ONLY" | "UPLOAD_REQUIRED" | "UNSUPPORTED">;
  capabilities: ProviderCapabilities;
  reason?: string;
}

import type { ValidationResult } from "../ssrf";

export interface MediaSourceAdapter {
  readonly key: string;
  /** cheap, synchronous shape check + SSRF-safe validation */
  validateUrl(url: string): ValidationResult;
  normalizeUrl(url: string): string;
  resolveMetadata(url: string): Promise<MediaMetadata>;
  checkAccess(url: string): Promise<AccessDecision>;
  getPermittedMedia(url: string): Promise<PermittedMedia>;
  getPreview(url: string): Promise<Preview>;
  getCapabilities(): ProviderCapabilities;
  returnFallbackInstructions(): FallbackInstructions;
}

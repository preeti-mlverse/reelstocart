import type { MediaSourceAdapter } from "./types";
import { createInstagramAdapter } from "./instagram";
import { createYouTubeAdapter } from "./youtube";
import { createDirectImageAdapter } from "./directImage";
import { createUploadAdapter } from "./upload";
import type { Config } from "../config";

export interface MediaRegistry {
  adapters: MediaSourceAdapter[];
  /** pick the adapter that accepts this input (URL or media id) */
  resolve(input: string): MediaSourceAdapter | null;
}

export function createMediaRegistry(cfg: Config): MediaRegistry {
  const adapters: MediaSourceAdapter[] = [
    createUploadAdapter(),
    createInstagramAdapter({ oEmbedEnabled: cfg.social.instagramOEmbed }),
    createYouTubeAdapter({ oEmbedEnabled: cfg.social.youtubeOEmbed, apiKey: cfg.social.youtubeApiKey }),
    createDirectImageAdapter({ allowLocalhost: cfg.nodeEnv !== "production" }),
  ];
  return {
    adapters,
    resolve(input: string): MediaSourceAdapter | null {
      // media id → upload; otherwise first adapter whose validateUrl passes
      for (const a of adapters) {
        if (a.validateUrl(input).ok) return a;
      }
      return null;
    },
  };
}

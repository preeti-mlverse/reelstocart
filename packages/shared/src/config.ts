/**
 * Centralised configuration. Reads env once, validates mode prerequisites,
 * and fails loudly (never hides a mock behind a real UI).
 */
export type RtcMode = "DEVELOPMENT_MOCK" | "REAL_LOCAL" | "REAL_HOSTED";

export interface Config {
  mode: RtcMode;
  nodeEnv: string;
  logLevel: string;
  web: { port: number; publicUrl: string; corsOrigins: string[] };
  visionUrl: string;
  databaseUrl?: string;
  redisUrl?: string;
  storage: { provider: string; bucket: string; signedUrlTtl: number; retentionSeconds: number };
  limits: {
    maxUploadBytes: number;
    maxVideoDurationSeconds: number;
    maxImageDimension: number;
    maxVideoFrames: number;
  };
  providers: {
    geminiApiKey?: string;
    geminiModel: string;
    openaiApiKey?: string;
    openaiEmbeddingModel: string;
    googleClientId?: string;
    googleClientSecret?: string;
  };
  cost: { monthlyBudgetUsd: number; perSearchCeilingUsd: number; alertThresholdPct: number };
  social: { instagramOEmbed: boolean; youtubeOEmbed: boolean; youtubeApiKey?: string };
}

const num = (v: string | undefined, d: number) => (v ? Number(v) : d);
const bool = (v: string | undefined, d = false) => (v == null ? d : /^(1|true|yes)$/i.test(v));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = (env.RTC_MODE as RtcMode) || "DEVELOPMENT_MOCK";
  return {
    mode,
    nodeEnv: env.NODE_ENV || "development",
    logLevel: env.LOG_LEVEL || "info",
    web: {
      port: num(env.WEB_PORT, 3000),
      publicUrl: env.WEB_PUBLIC_URL || "http://localhost:3000",
      corsOrigins: (env.CORS_ALLOWED_ORIGINS || "http://localhost:3000").split(",").map((s) => s.trim()),
    },
    visionUrl: env.VISION_SERVICE_URL || "http://localhost:8000",
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    storage: {
      provider: env.STORAGE_PROVIDER || "local",
      bucket: env.STORAGE_BUCKET || "rtc-media",
      signedUrlTtl: num(env.STORAGE_SIGNED_URL_TTL, 900),
      retentionSeconds: num(env.MEDIA_RETENTION_SECONDS, 86400),
    },
    limits: {
      maxUploadBytes: num(env.MAX_UPLOAD_BYTES, 104857600),
      maxVideoDurationSeconds: num(env.MAX_VIDEO_DURATION_SECONDS, 120),
      maxImageDimension: num(env.MAX_IMAGE_DIMENSION, 8000),
      maxVideoFrames: num(env.MAX_VIDEO_FRAMES, 1800),
    },
    providers: {
      geminiApiKey: env.GEMINI_API_KEY || undefined,
      geminiModel: env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      openaiApiKey: env.OPENAI_API_KEY || undefined,
      openaiEmbeddingModel: env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      googleClientId: env.GOOGLE_CLIENT_ID || undefined,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET || undefined,
    },
    cost: {
      monthlyBudgetUsd: num(env.COST_MONTHLY_BUDGET_USD, 50),
      perSearchCeilingUsd: num(env.COST_PER_SEARCH_CEILING_USD, 0.25),
      alertThresholdPct: num(env.COST_ALERT_THRESHOLD_PCT, 80),
    },
    social: {
      instagramOEmbed: bool(env.INSTAGRAM_OEMBED_ENABLED),
      youtubeOEmbed: bool(env.YOUTUBE_OEMBED_ENABLED, true),
      youtubeApiKey: env.YOUTUBE_API_KEY || undefined,
    },
  };
}

/** Validate that the selected mode has what it needs. Returns problems (empty = ok). */
export function validateMode(cfg: Config): string[] {
  const problems: string[] = [];
  if (cfg.mode === "REAL_HOSTED" && !cfg.providers.geminiApiKey && !cfg.providers.openaiApiKey) {
    problems.push("REAL_HOSTED requires GEMINI_API_KEY or OPENAI_API_KEY.");
  }
  if ((cfg.mode === "REAL_HOSTED" || cfg.mode === "REAL_LOCAL") && !cfg.databaseUrl) {
    problems.push(`${cfg.mode} requires DATABASE_URL.`);
  }
  return problems;
}

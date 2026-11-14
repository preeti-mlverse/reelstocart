/**
 * Fixed-window per-IP rate limiter (in-process). Good enough for a single VPS
 * node; swap for Redis when running more than one web replica.
 */
import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; reset: number }>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || req.ip || "unknown").trim();
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count++;
  const ok = b.count <= limit;
  return { ok, remaining: Math.max(0, limit - b.count), retryAfter: ok ? 0 : Math.ceil((b.reset - now) / 1000) };
}

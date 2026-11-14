import { NextResponse } from "next/server";
import { dbEnabled, dbHealthy } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISION_URL = process.env.VISION_SERVICE_URL || "http://localhost:8000";

export async function GET() {
  const [db, vision] = await Promise.all([
    dbEnabled() ? dbHealthy() : Promise.resolve(null),
    fetch(`${VISION_URL}/healthz`, { signal: AbortSignal.timeout(3000), cache: "no-store" })
      .then((r) => r.ok)
      .catch(() => false),
  ]);
  const ok = vision && db !== false;
  return NextResponse.json(
    { ok, checks: { db: db === null ? "disabled" : db ? "ok" : "down", vision: vision ? "ok" : "down" } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

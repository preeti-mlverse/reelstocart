import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/lib/orchestrate";
import { validateUpload } from "@rtc/shared";

export const runtime = "nodejs";
export const maxDuration = 60;

const VISION_URL = process.env.VISION_SERVICE_URL || "http://localhost:8000";
const LIMITS = {
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 104857600),
  maxImageDimension: Number(process.env.MAX_IMAGE_DIMENSION || 8000),
  maxVideoDurationSeconds: 120,
  maxVideoFrames: 1800,
};

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return err("BAD_REQUEST", "expected multipart form-data", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return err("NO_FILE", "missing 'file'", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Validate magic bytes + size BEFORE sending anywhere (Phase 2 security).
  const check = validateUpload(bytes, LIMITS);
  if (!check.ok) return err("INVALID_UPLOAD", check.reason ?? "invalid", 422);
  if (check.kind !== "image") return err("UNSUPPORTED", "only images in the minimal prototype", 415);

  const filters = {
    max_price_inr: numOrUndef(form.get("max_price_inr")),
    sizes: strListOrUndef(form.get("sizes")),
    in_stock_only: form.get("in_stock_only") === "true" || undefined,
  };

  try {
    const out = await runSearch(VISION_URL, bytes, filters, file.name, check.mime);
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    // Fail loud — no fabricated results on vision/provider failure.
    return err("VISION_UNAVAILABLE", msg, 502);
  }
}

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message, retriable: status >= 500 } }, { status });
}
function numOrUndef(v: FormDataEntryValue | null) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}
function strListOrUndef(v: FormDataEntryValue | null) {
  return typeof v === "string" && v.trim() ? v.split(",").map((s) => s.trim()) : undefined;
}

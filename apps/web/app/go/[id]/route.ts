/**
 * Outbound click tracking + affiliate redirect (Phase 11).
 * /go/<product uuid>?j=<search job uuid>
 * Logs a `click` product_event, appends UTM (and an affiliate tag when the
 * merchant is configured), then 302s to the merchant. Never indexable.
 */
import { NextRequest, NextResponse } from "next/server";
import { logClick } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const j = req.nextUrl.searchParams.get("j");
  if (!UUID.test(id)) return notFound();
  const url = await logClick(id, j && UUID.test(j) ? j : null);
  if (!url) return notFound();

  let dest: URL;
  try {
    dest = new URL(url);
  } catch {
    return notFound();
  }
  // Only ever redirect to http(s) merchant URLs from our own catalogue (no open redirect).
  if (dest.protocol !== "https:" && dest.protocol !== "http:") return notFound();
  dest.searchParams.set("utm_source", "reeltocart");
  dest.searchParams.set("utm_medium", "referral");
  dest.searchParams.set("utm_campaign", "visual_search");

  return NextResponse.redirect(dest.toString(), {
    status: 302,
    headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer-when-downgrade" },
  });
}

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
}

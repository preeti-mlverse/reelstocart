/**
 * Edge middleware:
 *  - /admin is protected by HTTP Basic auth (ADMIN_USER / ADMIN_PASSWORD).
 *    If ADMIN_PASSWORD is unset the admin area is disabled (404), never open.
 *  - Non-production hosts get X-Robots-Tag: noindex on every response.
 */
import { NextRequest, NextResponse } from "next/server";

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const pass = process.env.ADMIN_PASSWORD;
    if (!pass) return new NextResponse("Not found", { status: 404 });
    const user = process.env.ADMIN_USER || "admin";
    const header = req.headers.get("authorization") || "";
    const [scheme, encoded] = header.split(" ");
    let ok = false;
    if (scheme === "Basic" && encoded) {
      try {
        const [u, ...rest] = atob(encoded).split(":");
        ok = timingSafeEqual(u, user) && timingSafeEqual(rest.join(":"), pass);
      } catch { ok = false; }
    }
    if (!ok) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Reel-to-Cart admin"', "X-Robots-Tag": "noindex" },
      });
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const res = NextResponse.next();
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "true") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

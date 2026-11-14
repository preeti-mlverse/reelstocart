import type { MetadataRoute } from "next";
import { ALLOW_INDEXING, SITE_URL, abs } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    // Staging / local: keep everything out of search engines.
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/go/"] },
    ],
    sitemap: abs("/sitemap.xml"),
    host: SITE_URL,
  };
}

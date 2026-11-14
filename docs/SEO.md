# SEO — what is implemented and the go-live checklist

## Implemented (apps/web)

**Indexing safety**
- `NEXT_PUBLIC_ALLOW_INDEXING=true` only on production. Otherwise: `robots.txt` → `Disallow: /`, every page gets
  `<meta name="robots" content="noindex, nofollow">` and an `X-Robots-Tag: noindex` header (middleware). Staging can't
  leak into Google. ⚠️ It is a `NEXT_PUBLIC_` var → **set it at build time** (`next build`), not only at runtime.
- `/api/*`, `/admin`, `/go/*` are disallowed in robots and always send `X-Robots-Tag: noindex`.
- Sample/fixture products (`is_sample`) are `noindex` and excluded from the sitemap.

**Crawlable, server-rendered pages**
| URL | Purpose | Rendering |
|---|---|---|
| `/` | Hero + finder + how-it-works + categories + FAQ | static |
| `/shop` | Category hub | dynamic (DB) |
| `/shop/{dress,top,co-ord-sets,shirt,jeans,trousers,skirt,jacket,blazer}` | Category landing pages with unique copy, paginated `?page=n` (self-canonical, rel prev/next links) | dynamic |
| `/products/<slug>-<uuid>` | Product detail: H1, price, specs, description, "visually similar" internal links (pgvector) | dynamic |
| `/how-it-works` | Long-form explainer + FAQ | static |
| `/privacy`, `/terms` | Trust pages (drafts — review before launch) | static |

Wrong slugs (`/products/old-title-<uuid>`, `/shop/co_ord_set`) 308-redirect to the canonical URL; `/faq` → `/how-it-works#faq`.

**Metadata** (Next Metadata API, `app/layout.tsx` + per page)
- `metadataBase` from `NEXT_PUBLIC_SITE_URL`; title template `%s | Reel-to-Cart`; unique title + description per page
  (product titles include price in ₹; category titles target "shop X you saw on reels").
- Canonical + `hreflang` (`en-IN`, `x-default`) on every page (`alternatesFor()` in `lib/site.ts`).
- Open Graph (`en_IN`) + Twitter `summary_large_image`; generated 1200×630 OG image (`app/opengraph-image.tsx`);
  product pages use the product photo.
- `lang="en-IN"`, viewport + light/dark `theme-color`, web manifest, SVG icon.
- Search Console / Bing verification via `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION`.

**Structured data (JSON-LD)**
- Site-wide: `Organization`, `WebSite`.
- Home: `WebApplication` (free, INR), `HowTo`, `FAQPage`.
- Category: `BreadcrumbList`, `ItemList` of product URLs.
- Product: `Product` with `Offer` (price, `INR`, availability, condition, seller), `Brand`, colour/pattern/size, `BreadcrumbList`.
- `<` is escaped inside JSON-LD so titles can't break out of the script tag.

**Sitemap** — `/sitemap.xml` (dynamic, revalidated hourly): static pages, non-empty categories, every real product
with `lastModified`. Up to 45k product URLs; split into a sitemap index beyond that.

**Links & affiliate hygiene** — outbound store links go through `/go/<id>` (302, click logged, UTM added) and carry
`rel="sponsored nofollow noopener noreferrer"`. Internal links: header nav, footer category links, breadcrumbs,
"similar styles" grids.

**Performance / UX signals** — semantic landmarks, skip link, alt text on every image (verified 0 missing),
explicit `width`/`height` on images (no CLS), lazy loading below the fold, `fetchPriority="high"` on the PDP hero image,
long-cache headers on static images, gzip, no `X-Powered-By`, HSTS + security headers.

## Go-live checklist (needs you / the live domain)
1. Set on the VPS **before `next build`**: `NEXT_PUBLIC_SITE_URL=https://<domain>`, `NEXT_PUBLIC_ALLOW_INDEXING=true`,
   `NEXT_PUBLIC_DEMO_CATALOGUE=false` once real merchant feeds replace mock.shop.
2. Remove demo catalogues (mock.shop, sample fixtures) from production before allowing indexing —
   otherwise Google indexes demo products.
3. Google Search Console + Bing Webmaster: verify the domain (DNS TXT or the meta-tag env vars), submit `/sitemap.xml`.
4. Validate with the Rich Results Test (Product, FAQ, Breadcrumb) and PageSpeed Insights on a product + category page.
5. Serve over HTTPS only (Caddy/Nginx), redirect `www` ↔ apex to one host.
6. Publish a real contact address on `/privacy` and have the privacy/terms drafts reviewed.
7. Optional growth: a short blog/guide section ("how to find clothes from an Instagram reel"), Hindi (`hi-IN`) pages
   using the existing `alternatesFor()` hreflang hook, `next/image` once merchant image hosts are known.

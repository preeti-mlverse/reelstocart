/**
 * Site-wide constants used by SEO metadata, JSON-LD, sitemap and navigation.
 * Everything environment-specific comes from env so staging never gets indexed.
 */
export const SITE = {
  name: "Reel-to-Cart",
  shortName: "ReelToCart",
  tagline: "Shop the look from any reel or photo",
  description:
    "Upload a photo or short video of an outfit you love — from an Instagram reel, a YouTube short or a street-style shot — " +
    "and Reel-to-Cart finds visually similar dresses, tops, jeans, co-ord sets and more from online stores in India, with honest match labels and prices in ₹.",
  locale: "en_IN",
  lang: "en-IN",
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE || undefined,
  themeColor: "#e8536b",
  keywords: [
    "shop the look",
    "find outfit from photo",
    "find clothes from instagram reel",
    "visual search fashion India",
    "reverse image search clothes",
    "outfit finder",
    "similar dresses online India",
    "AI fashion search",
    "co-ord sets online",
    "shop reels outfits",
  ],
};

/** Absolute origin, no trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/+$/, "");

/** Only production should be indexable. Anything else sends noindex + Disallow: /. */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export const abs = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export interface CategoryInfo {
  slug: string;
  label: string;
  singular: string;
  intro: string;
  keywords: string[];
}

/** Launch categories with unique, human copy for their landing pages. */
export const CATEGORY_INFO: Record<string, CategoryInfo> = {
  dress: {
    slug: "dress", label: "Dresses", singular: "dress",
    intro: "Midi, maxi, wrap, A-line and bodycon dresses. Spotted a dress in a reel? Upload a screenshot and we’ll match the colour, silhouette, neckline and length.",
    keywords: ["dresses online India", "midi dress", "maxi dress", "find dress from photo"],
  },
  top: {
    slug: "top", label: "Tops", singular: "top",
    intro: "Crop tops, camis, blouses and tees. We compare neckline, sleeve type, pattern and colour to find tops that look like the one you saw.",
    keywords: ["tops for women online", "crop tops", "find top from instagram"],
  },
  shirt: {
    slug: "shirt", label: "Shirts", singular: "shirt",
    intro: "Oversized, fitted, linen and printed shirts — matched on collar, sleeve length, pattern and fit.",
    keywords: ["shirts online India", "oversized shirt", "linen shirt"],
  },
  skirt: {
    slug: "skirt", label: "Skirts", singular: "skirt",
    intro: "Mini, midi and maxi skirts, from pleated to slip skirts. Match the length, silhouette and print of any skirt you’ve seen.",
    keywords: ["skirts online India", "midi skirt", "pleated skirt"],
  },
  jeans: {
    slug: "jeans", label: "Jeans", singular: "pair of jeans",
    intro: "Wide-leg, straight, flared and skinny jeans. We look at wash, fit and leg shape to find the closest denim.",
    keywords: ["jeans for women", "wide leg jeans", "find jeans from photo"],
  },
  trousers: {
    slug: "trousers", label: "Trousers", singular: "pair of trousers",
    intro: "Tailored trousers, cargo pants, palazzos and chinos — matched on silhouette, colour and fabric look.",
    keywords: ["trousers for women", "wide leg trousers", "cargo pants"],
  },
  co_ord_set: {
    slug: "co-ord-sets", label: "Co-ord Sets", singular: "co-ord set",
    intro: "Matching sets are the most-saved looks on reels. Find two-piece co-ords that match the print, colour and cut.",
    keywords: ["co-ord sets online", "matching sets", "two piece set"],
  },
  jacket: {
    slug: "jacket", label: "Jackets", singular: "jacket",
    intro: "Denim, bomber, leather-look and puffer jackets matched on length, closure and colour.",
    keywords: ["jackets for women", "denim jacket", "bomber jacket"],
  },
  blazer: {
    slug: "blazer", label: "Blazers", singular: "blazer",
    intro: "Oversized, cropped and tailored blazers for work and going out — matched on fit, lapel look and colour.",
    keywords: ["blazers for women", "oversized blazer", "find blazer from photo"],
  },
};

export const CATEGORY_ORDER = ["dress", "top", "co_ord_set", "shirt", "jeans", "trousers", "skirt", "jacket", "blazer"];

export const categoryFromSlug = (slug: string) =>
  Object.entries(CATEGORY_INFO).find(([, c]) => c.slug === slug)?.[0];

export const categoryPath = (category: string) => `/shop/${CATEGORY_INFO[category]?.slug ?? category}`;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const UUID_TAIL = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Stable product URL: /products/<readable-slug>-<uuid>. */
export const productPath = (title: string, id: string) => `/products/${slugify(title)}-${id}`;
export const idFromHandle = (handle: string) => handle.match(UUID_TAIL)?.[1]?.toLowerCase() ?? null;

export const formatInr = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;

export const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I find an outfit from an Instagram reel?",
    a: "Take a screenshot of the frame where the outfit is clearly visible (or download a short clip you have the rights to), then upload it to Reel-to-Cart. We detect each garment, read its colour, pattern, neckline, sleeves and silhouette, and show the closest products we can find with prices in ₹.",
  },
  {
    q: "Can I paste an Instagram or YouTube link directly?",
    a: "Not yet. We don’t scrape social platforms. For now, upload a screenshot or a short video you’ve saved — it works just as well and keeps your data private.",
  },
  {
    q: "Will I find the exact same product?",
    a: "Sometimes. Every result carries an honest label — Very close, Similar or Style alternative — and we explain what matches and what differs. We never claim an exact match unless the product identity is verified.",
  },
  {
    q: "Is Reel-to-Cart free to use?",
    a: "Yes. We may earn a commission when you buy through some store links, which never changes the price you pay or the order of results.",
  },
  {
    q: "What happens to the photos I upload?",
    a: "Your upload is analysed in memory only to find garments. We don’t store, publish or share it, and we don’t use your photos to train models.",
  },
  {
    q: "Can I set a budget?",
    a: "Yes. Set a maximum price per item, or a total budget for the whole look and we’ll assemble the best-matching outfit that fits it.",
  },
];

/** Canonical + hreflang for a page (single-locale site today; ready for hi-IN later). */
export const alternatesFor = (path: string) => ({
  canonical: path,
  languages: { "en-IN": path, "x-default": path },
});

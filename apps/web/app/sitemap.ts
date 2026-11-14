import type { MetadataRoute } from "next";
import { categoryCounts, sitemapProducts } from "@/lib/db";
import { CATEGORY_ORDER, abs, categoryPath, productPath } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [counts, products] = await Promise.all([categoryCounts(), sitemapProducts()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: abs("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: abs("/shop"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: abs("/how-it-works"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: abs("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: abs("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const categories: MetadataRoute.Sitemap = CATEGORY_ORDER
    .filter((c) => (counts[c]?.count ?? 0) > 0)
    .map((c) => ({ url: abs(categoryPath(c)), lastModified: now, changeFrequency: "daily", priority: 0.8 }));

  const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
    url: abs(productPath(p.title, p.id)),
    lastModified: new Date(p.updated_at),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticPages, ...categories, ...productUrls];
}

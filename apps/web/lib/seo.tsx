/** JSON-LD structured data builders (schema.org) + a tiny renderer component. */
import { SITE, SITE_URL, abs, FAQ, productPath, type CategoryInfo } from "./site";
import type { ProductRow } from "./db";

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped so a product title can't close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export const organizationLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE.name,
  url: SITE_URL,
  logo: abs("/icon.svg"),
  description: SITE.description,
  areaServed: "IN",
});

export const websiteLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE.name,
  url: SITE_URL,
  inLanguage: SITE.lang,
  publisher: { "@id": `${SITE_URL}/#organization` },
});

export const webAppLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE_URL,
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  description: SITE.description,
});

export const faqLd = (items = FAQ): Json => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

export const howToLd = (): Json => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to find an outfit from a reel or photo",
  totalTime: "PT1M",
  step: [
    { "@type": "HowToStep", position: 1, name: "Capture the look", text: "Screenshot the frame of the reel where the outfit is clearly visible, or save a short clip." },
    { "@type": "HowToStep", position: 2, name: "Upload it", text: "Upload the photo or video to Reel-to-Cart and optionally set a budget." },
    { "@type": "HowToStep", position: 3, name: "Pick the outfit", text: "For videos, choose which outfit you want to shop." },
    { "@type": "HowToStep", position: 4, name: "Shop matches", text: "Compare labelled matches with prices in ₹ and buy from the store." },
  ],
});

export const breadcrumbLd = (crumbs: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.path) })),
});

const AVAIL: Record<string, string> = {
  in_stock: "https://schema.org/InStock",
  out_of_stock: "https://schema.org/OutOfStock",
};

export function productLd(p: ProductRow): Json {
  const url = abs(productPath(p.title, p.id));
  const ld: Json = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.title,
    image: p.image ? [p.image] : undefined,
    description: p.description ?? `${p.title}${p.color ? ` in ${p.color}` : ""} from ${p.merchant}.`,
    sku: p.id,
    category: p.category,
    color: p.color ?? undefined,
    pattern: p.pattern ?? undefined,
    size: p.sizes.length ? p.sizes.join(", ") : undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    url,
  };
  if (p.price_inr != null) {
    ld.offers = {
      "@type": "Offer",
      url,
      price: p.price_inr.toFixed(2),
      priceCurrency: "INR",
      availability: AVAIL[p.availability] ?? "https://schema.org/LimitedAvailability",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: p.merchant },
    };
  }
  return ld;
}

export const itemListLd = (cat: CategoryInfo, items: ProductRow[], offset = 0): Json => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: cat.label,
  numberOfItems: items.length,
  itemListElement: items.map((p, i) => ({
    "@type": "ListItem",
    position: offset + i + 1,
    url: abs(productPath(p.title, p.id)),
    name: p.title,
  })),
});

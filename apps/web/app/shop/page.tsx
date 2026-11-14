import type { Metadata } from "next";
import Link from "next/link";
import { categoryCounts } from "@/lib/db";
import { CATEGORY_INFO, CATEGORY_ORDER, categoryPath, alternatesFor } from "@/lib/site";
import { JsonLd, breadcrumbLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop women’s fashion by category",
  description:
    "Browse dresses, tops, co-ord sets, shirts, jeans, trousers, skirts, jackets and blazers — or upload a photo to find a look you saw on a reel.",
  alternates: alternatesFor("/shop"),
  openGraph: { url: "/shop", title: "Shop women’s fashion by category" },
};

export default async function ShopIndex() {
  const counts = await categoryCounts();
  return (
    <main className="wrap wrap-wide">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Shop</span></nav>
      <h1 className="h1">Shop by category</h1>
      <p className="sub">Pick a category, or <Link href="/#finder">upload a photo</Link> to find a specific look.</p>
      <ul className="cat-grid">
        {CATEGORY_ORDER.map((c) => {
          const info = CATEGORY_INFO[c];
          const meta = counts[c];
          return (
            <li key={c}>
              <Link href={categoryPath(c)} className="cat-card">
                {meta?.image ? <img src={meta.image} alt={info.label} width={300} height={400} loading="lazy" decoding="async" /> : <div className="cat-ph" aria-hidden />}
                <div className="body">
                  <h2 className="title">{info.label}</h2>
                  <span className="muted">{meta ? `${meta.count} styles` : "Coming soon"}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Shop", path: "/shop" }])} />
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getProduct, similarProducts } from "@/lib/db";
import { CATEGORY_INFO, categoryPath, formatInr, idFromHandle, productPath, alternatesFor } from "@/lib/site";
import { JsonLd, breadcrumbLd, productLd } from "@/lib/seo";
import ProductCard from "../../components/ProductCard";

export const dynamic = "force-dynamic";

type Props = { params: { handle: string } };

const nice = (s: string | null) => (s ? s.replace(/_/g, " ") : null);

async function load(handle: string) {
  const id = idFromHandle(handle);
  return id ? getProduct(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load(params.handle);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const path = productPath(p.title, p.id);
  const bits = [nice(p.color), nice(p.pattern), CATEGORY_INFO[p.category]?.singular ?? p.category].filter(Boolean).join(" ");
  const description =
    `${p.title}${p.brand ? ` by ${p.brand}` : ""} — ${bits}${p.price_inr != null ? ` for ${formatInr(p.price_inr)}` : ""}. ` +
    `Compare similar styles and shop at ${p.merchant}.`;
  return {
    title: `${p.title}${p.price_inr != null ? ` – ${formatInr(p.price_inr)}` : ""}`,
    description: description.slice(0, 300),
    alternates: alternatesFor(path),
    // Fixture/sample products must never be indexed (otherwise inherit the site-wide robots policy).
    ...(p.is_sample ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      url: path,
      title: p.title,
      description,
      images: p.image ? [{ url: p.image, alt: p.title }] : undefined,
    },
    twitter: { card: "summary_large_image", images: p.image ? [p.image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const p = await load(params.handle);
  if (!p) notFound();
  const canonical = productPath(p.title, p.id);
  if (`/products/${params.handle}` !== canonical) permanentRedirect(canonical);

  const similar = await similarProducts(p.id, 8);
  const cat = CATEGORY_INFO[p.category];
  const specs: [string, string | null][] = [
    ["Colour", nice(p.color)], ["Pattern", nice(p.pattern)], ["Silhouette", nice(p.silhouette)],
    ["Neckline", nice(p.neckline)], ["Sleeves", nice(p.sleeve_type)], ["Length", nice(p.garment_length)],
    ["Sizes", p.sizes.length ? p.sizes.join(", ") : null],
  ];

  return (
    <main className="wrap wrap-wide">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">Shop</Link> /{" "}
        {cat ? <Link href={categoryPath(p.category)}>{cat.label}</Link> : p.category} / <span>{p.title}</span>
      </nav>

      <article className="pdp">
        <div className="pdp-media">
          <img src={p.image} alt={`${p.title}${p.color ? ` in ${nice(p.color)}` : ""}`} width={600} height={800} fetchPriority="high" />
        </div>
        <div className="pdp-info">
          <p className="eyebrow">{p.brand ?? p.merchant}</p>
          <h1 className="h1">{p.title}</h1>
          <p className="pdp-price">
            {formatInr(p.price_inr)}
            {p.mrp_inr && p.mrp_inr > (p.price_inr ?? 0) ? <span className="mrp">{formatInr(p.mrp_inr)}</span> : null}
          </p>
          <p className="muted">
            {p.availability === "in_stock" ? "In stock" : p.availability === "out_of_stock" ? "Out of stock" : "Stock unverified"}
            {" · "}Sold by {p.merchant}
            {p.is_sample ? " · sample fixture (not a real listing)" : ""}
          </p>
          <a className="btn" href={`/go/${p.id}`} target="_blank" rel="sponsored nofollow noopener noreferrer">
            Buy at {p.merchant} →
          </a>
          {p.description && <p className="pdp-desc">{p.description}</p>}
          <dl className="specs">
            {specs.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <p className="muted">
            Saw something like this on a reel? <Link href="/#finder">Upload the screenshot</Link> to find the closest match.
          </p>
        </div>
      </article>

      {similar.length > 0 && (
        <section className="block" aria-labelledby="similar">
          <h2 id="similar" className="h2">Visually similar styles</h2>
          <div className="grid grid-lg">
            {similar.map((s) => <ProductCard key={s.id} p={s} />)}
          </div>
        </section>
      )}

      <JsonLd data={[
        productLd(p),
        breadcrumbLd([
          { name: "Home", path: "/" }, { name: "Shop", path: "/shop" },
          ...(cat ? [{ name: cat.label, path: categoryPath(p.category) }] : []),
          { name: p.title, path: canonical },
        ]),
      ]} />
    </main>
  );
}

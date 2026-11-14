import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { listProducts } from "@/lib/db";
import { CATEGORY_INFO, categoryFromSlug, categoryPath, alternatesFor } from "@/lib/site";
import { JsonLd, breadcrumbLd, itemListLd } from "@/lib/seo";
import ProductCard from "../../components/ProductCard";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 24;

type Props = { params: { category: string }; searchParams: { page?: string } };

function resolve(slug: string) {
  // Accept the raw taxonomy key too (e.g. co_ord_set) but canonicalise to the slug.
  const key = categoryFromSlug(slug) ?? (CATEGORY_INFO[slug] ? slug : null);
  return key ? { key, info: CATEGORY_INFO[key] } : null;
}

const pageNum = (s?: string) => Math.max(1, Math.floor(Number(s) || 1));

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const r = resolve(params.category);
  if (!r) return { title: "Not found", robots: { index: false } };
  const page = pageNum(searchParams.page);
  const path = categoryPath(r.key) + (page > 1 ? `?page=${page}` : "");
  const title = `${r.info.label} — shop ${r.info.label.toLowerCase()} you saw on reels${page > 1 ? ` (page ${page})` : ""}`;
  return {
    title,
    description: `${r.info.intro} Prices in ₹ from online stores in India.`,
    keywords: r.info.keywords,
    alternates: alternatesFor(path),
    openGraph: { url: path, title, description: r.info.intro },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const r = resolve(params.category);
  if (!r) notFound();
  if (params.category !== r.info.slug) permanentRedirect(categoryPath(r.key));

  const page = pageNum(searchParams.page);
  const offset = (page - 1) * PAGE_SIZE;
  const { items, total } = await listProducts(r.key, PAGE_SIZE, offset);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages && total > 0) notFound();

  return (
    <main className="wrap wrap-wide">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">Shop</Link> / <span>{r.info.label}</span>
      </nav>
      <h1 className="h1">{r.info.label}</h1>
      <p className="sub">{r.info.intro}</p>
      <p><Link href="/#finder" className="btn btn-ghost">Find a {r.info.singular} from a photo →</Link></p>

      {items.length === 0 ? (
        <p className="muted">No {r.info.label.toLowerCase()} in the catalogue yet — check back soon.</p>
      ) : (
        <div className="grid grid-lg">
          {items.map((p, i) => <ProductCard key={p.id} p={p} eager={i < 4} />)}
        </div>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {page > 1 && <Link rel="prev" href={`${categoryPath(r.key)}${page - 1 > 1 ? `?page=${page - 1}` : ""}`}>← Previous</Link>}
          <span className="muted">Page {page} of {pages}</span>
          {page < pages && <Link rel="next" href={`${categoryPath(r.key)}?page=${page + 1}`}>Next →</Link>}
        </nav>
      )}

      <JsonLd data={[
        breadcrumbLd([
          { name: "Home", path: "/" }, { name: "Shop", path: "/shop" },
          { name: r.info.label, path: categoryPath(r.key) },
        ]),
        itemListLd(r.info, items, offset),
      ]} />
    </main>
  );
}

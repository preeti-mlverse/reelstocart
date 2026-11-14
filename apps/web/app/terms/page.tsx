import type { Metadata } from "next";
import { alternatesFor } from "@/lib/site";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & affiliate disclosure",
  description: "Terms of use for Reel-to-Cart and our affiliate disclosure.",
  alternates: alternatesFor("/terms"),
};

export default function Terms() {
  return (
    <main className="wrap prose">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Terms</span></nav>
      <h1 className="h1">Terms &amp; affiliate disclosure</h1>
      <p className="muted">Draft — to be reviewed before public launch.</p>
      <h2 className="h2">Using Reel-to-Cart</h2>
      <p>
        Only upload images or videos you have the right to use. Results are suggestions of visually similar products;
        prices, sizes and stock are shown as provided by stores and may change. Always confirm details on the store’s site
        before buying.
      </p>
      <h2 className="h2">Affiliate disclosure</h2>
      <p>
        Some links to stores are affiliate links: we may earn a commission if you buy, at no extra cost to you.
        Commissions never affect the ranking of results, which are ordered by visual and attribute similarity.
        Any sponsored placement will always be clearly labelled.
      </p>
      <h2 className="h2">Trademarks</h2>
      <p>Brand and store names belong to their respective owners and are used only to identify products.</p>
    </main>
  );
}

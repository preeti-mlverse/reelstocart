import type { Metadata } from "next";
import { alternatesFor } from "@/lib/site";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Reel-to-Cart handles the photos and videos you upload, and what data we keep.",
  alternates: alternatesFor("/privacy"),
};

export default function Privacy() {
  return (
    <main className="wrap prose">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>Privacy</span></nav>
      <h1 className="h1">Privacy policy</h1>
      <p className="muted">Draft — to be reviewed before public launch.</p>
      <h2 className="h2">Your uploads</h2>
      <p>
        Photos and videos you upload are processed in memory to detect garments and are not stored, published or shared
        with other users. Frames are sent to our AI vision provider solely to perform that analysis. We don’t use your
        uploads to train models.
      </p>
      <h2 className="h2">What we log</h2>
      <p>
        We keep anonymous search records (garment categories detected, products shown, products clicked, processing cost)
        to improve results and measure store referrals. These records contain no images and no account information.
      </p>
      <h2 className="h2">Store links</h2>
      <p>
        When you click through to a store we add referral tags to the link. The store’s own privacy policy applies once
        you leave Reel-to-Cart.
      </p>
      <h2 className="h2">Contact &amp; deletion</h2>
      <p>To ask about or delete any data associated with you, contact us via the address listed on this site at launch.</p>
    </main>
  );
}

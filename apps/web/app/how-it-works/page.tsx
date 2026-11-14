import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, alternatesFor } from "@/lib/site";
import { JsonLd, breadcrumbLd, faqLd, howToLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How it works — find clothes from a reel, screenshot or photo",
  description:
    "How Reel-to-Cart turns a reel screenshot or short video into shoppable products: garment detection, attribute reading, visual similarity search and honest match labels.",
  alternates: alternatesFor("/how-it-works"),
  openGraph: { url: "/how-it-works", title: "How Reel-to-Cart finds the outfit" },
};

export default function HowItWorks() {
  return (
    <main className="wrap prose">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span>How it works</span></nav>
      <h1 className="h1">How Reel-to-Cart finds the outfit</h1>
      <p className="sub">From a reel screenshot to products you can buy, in four steps.</p>

      <h2 className="h2">1. You share the look</h2>
      <p>
        Upload a screenshot or photo (JPG, PNG, WebP) or a short video clip (MP4, WebM, MOV). For videos we sample the
        sharpest frames, detect scene changes, and group them into distinct outfits so you can choose the one you want.
        We don’t scrape Instagram or YouTube — uploading is faster and keeps you in control of your data.
      </p>

      <h2 className="h2">2. AI detects every garment</h2>
      <p>
        A vision model locates each piece — dresses, tops, shirts, skirts, jeans, trousers, co-ord sets, jackets and
        blazers — and reads its attributes: primary colour, pattern, silhouette, neckline, sleeve type and length. Each
        attribute carries a confidence score, and anything the model can’t see clearly is marked unknown instead of guessed.
      </p>

      <h2 className="h2">3. Visual + attribute search</h2>
      <p>
        Each garment is turned into a fashion-specific visual embedding and searched against store catalogues using a
        vector index. Candidates are then re-ranked by combining visual similarity with attribute agreement, and
        penalised hard for clear mismatches like the wrong category or a clashing colour.
      </p>

      <h2 className="h2">4. Honest labels, your budget</h2>
      <p>
        Results are labelled <b>Very close</b>, <b>Similar</b> or <b>Style alternative</b>, with a short explanation of
        what matches and what differs. We never call something an exact match unless its identity is verified. Set a
        price cap per item or a total budget and we’ll assemble the best-matching complete look that fits.
      </p>

      <h2 id="faq" className="h2">FAQ</h2>
      {FAQ.map((f) => (
        <details key={f.q} className="faq" open>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}

      <p><Link href="/#finder" className="btn">Try it with a photo →</Link></p>

      <JsonLd data={[
        howToLd(), faqLd(),
        breadcrumbLd([{ name: "Home", path: "/" }, { name: "How it works", path: "/how-it-works" }]),
      ]} />
    </main>
  );
}

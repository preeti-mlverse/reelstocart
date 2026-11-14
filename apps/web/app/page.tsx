import Link from "next/link";
import Finder from "./components/Finder";
import { CATEGORY_INFO, CATEGORY_ORDER, FAQ, categoryPath, alternatesFor } from "@/lib/site";
import { JsonLd, faqLd, howToLd, webAppLd } from "@/lib/seo";

export const metadata = {
  alternates: alternatesFor("/"),
};

const DEMO = process.env.NEXT_PUBLIC_DEMO_CATALOGUE !== "false";

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <p className="eyebrow">Visual fashion search · India</p>
        <h1 className="h1">Shop the look from any reel or photo</h1>
        <p className="sub">
          Upload a screenshot from an Instagram reel, a YouTube short or a street-style photo. We detect every
          garment, read its colour, print and cut, and find the closest pieces you can buy online — with prices in ₹.
        </p>
      </section>

      {DEMO && (
        <div className="banner" role="note">
          Early preview: results currently come from demo store catalogues while merchant partnerships go live.
          Garment detection runs on your actual upload.
        </div>
      )}

      <Finder />

      <section className="block" aria-labelledby="how">
        <h2 id="how" className="h2">How it works</h2>
        <ol className="how">
          <li><b>Capture</b> Screenshot the reel frame or save a short clip.</li>
          <li><b>Upload</b> Add it here and set a budget if you like.</li>
          <li><b>Detect</b> AI finds each garment — dress, top, jeans, co-ord, jacket — and its attributes.</li>
          <li><b>Shop</b> Compare honestly labelled matches and buy from the store.</li>
        </ol>
        <p><Link href="/how-it-works">Read more about how matching works →</Link></p>
      </section>

      <section className="block" aria-labelledby="cats">
        <h2 id="cats" className="h2">Browse by category</h2>
        <ul className="cat-pills">
          {CATEGORY_ORDER.map((c) => (
            <li key={c}><Link href={categoryPath(c)} className="pill">{CATEGORY_INFO[c].label}</Link></li>
          ))}
        </ul>
      </section>

      <section className="block" aria-labelledby="faq">
        <h2 id="faq" className="h2">Frequently asked questions</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <JsonLd data={[webAppLd(), howToLd(), faqLd()]} />
    </main>
  );
}

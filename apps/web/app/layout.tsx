import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SITE, SITE_URL, ALLOW_INDEXING, CATEGORY_INFO, CATEGORY_ORDER, categoryPath, alternatesFor } from "@/lib/site";
import { JsonLd, organizationLd, websiteLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: SITE.keywords,
  authors: [{ name: SITE.name, url: SITE_URL }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "shopping",
  formatDetection: { telephone: false, email: false, address: false },
  alternates: alternatesFor("/"),
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: "/",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    ...(SITE.twitter ? { site: SITE.twitter, creator: SITE.twitter } : {}),
  },
  robots: ALLOW_INDEXING
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
      }
    : { index: false, follow: false, googleBot: { index: false, follow: false } },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.lang}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <nav className="nav" aria-label="Primary">
            <Link href="/" className="logo" aria-label={`${SITE.name} home`}>
              <span className="logo-mark" aria-hidden>◐</span> {SITE.name}
            </Link>
            <div className="nav-links">
              <Link href="/shop">Shop</Link>
              <Link href="/how-it-works">How it works</Link>
              <Link href="/#finder" className="nav-cta">Find a look</Link>
            </div>
          </nav>
        </header>
        <div id="main">{children}</div>
        <footer className="site-footer">
          <div className="footer-grid">
            <div>
              <p className="footer-brand">{SITE.name}</p>
              <p className="muted">{SITE.tagline}. Visual fashion search for India.</p>
            </div>
            <nav aria-label="Categories">
              <p className="footer-h">Shop</p>
              <ul>
                {CATEGORY_ORDER.map((c) => (
                  <li key={c}><Link href={categoryPath(c)}>{CATEGORY_INFO[c].label}</Link></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Company">
              <p className="footer-h">Reel-to-Cart</p>
              <ul>
                <li><Link href="/how-it-works">How it works</Link></li>
                <li><Link href="/how-it-works#faq">FAQ</Link></li>
                <li><Link href="/privacy">Privacy</Link></li>
                <li><Link href="/terms">Terms &amp; disclosure</Link></li>
              </ul>
            </nav>
          </div>
          <p className="muted footer-note">
            Some store links may earn us a commission. It never changes your price or the order of results.
          </p>
        </footer>
        <JsonLd data={[organizationLd(), websiteLd()]} />
      </body>
    </html>
  );
}

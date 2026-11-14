import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main className="wrap">
      <h1 className="h1">We couldn’t find that page</h1>
      <p className="sub">The product may have sold out or moved.</p>
      <p><Link href="/shop">Browse the shop</Link> or <Link href="/#finder">find a look from a photo</Link>.</p>
    </main>
  );
}

import Link from "next/link";
import type { ProductRow } from "@/lib/db";
import { formatInr, productPath } from "@/lib/site";

export default function ProductCard({ p, eager = false }: { p: ProductRow; eager?: boolean }) {
  return (
    <article className="card">
      <Link href={productPath(p.title, p.id)} className="card-link">
        <img src={p.image} alt={`${p.title}${p.color ? ` — ${p.color}` : ""}`} width={300} height={400}
             loading={eager ? "eager" : "lazy"} decoding="async" />
        <div className="body">
          <h3 className="title">{p.title}</h3>
          <div className="price">
            {formatInr(p.price_inr)}
            {p.mrp_inr && p.mrp_inr > (p.price_inr ?? 0) ? <span className="mrp">{formatInr(p.mrp_inr)}</span> : null}
          </div>
          <div className="muted">{p.brand ?? p.merchant}{p.is_sample ? " · sample" : ""}</div>
        </div>
      </Link>
    </article>
  );
}

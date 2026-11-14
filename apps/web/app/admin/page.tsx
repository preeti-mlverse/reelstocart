import type { Metadata } from "next";
import Link from "next/link";
import { adminStats } from "@/lib/db";
import { productPath } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const fmt = (d: unknown) => (d ? new Date(d as string).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const usd = (n: unknown) => `$${Number(n ?? 0).toFixed(4)}`;

export default async function Admin() {
  const s = await adminStats();
  if (!s) {
    return <main className="wrap"><h1 className="h1">Admin</h1><div className="err">Database unavailable.</div></main>;
  }
  const ev = Object.fromEntries((s.events as any[]).map((e) => [e.kind, e.n]));
  const ctr = ev.impression ? ((ev.click ?? 0) / ev.impression) * 100 : 0;
  const c = s.catalogue as any;
  const sj = s.searches as any;

  return (
    <main className="wrap wrap-wide admin">
      <h1 className="h1">Admin dashboard</h1>
      <p className="sub">Catalogue health, searches, referrals and AI cost.</p>

      <div className="kpis">
        <div className="kpi"><span>Products</span><b>{c.products - c.deleted}</b><small>{c.deleted} deleted</small></div>
        <div className="kpi"><span>Embedded</span><b>{c.embeddings}</b><small>{c.merchants} merchants</small></div>
        <div className="kpi"><span>Searches (7d)</span><b>{sj.last_7d}</b><small>{sj.last_24h} today · {sj.total} all-time</small></div>
        <div className="kpi"><span>Clicks (30d)</span><b>{ev.click ?? 0}</b><small>{ev.impression ?? 0} impressions · CTR {ctr.toFixed(1)}%</small></div>
        <div className="kpi"><span>AI spend</span><b>{usd(sj.cost_usd)}</b><small>all searches</small></div>
      </div>

      <h2 className="h2">Merchants</h2>
      <table className="tbl">
        <thead><tr><th>Merchant</th><th>Integration</th><th>Products</th><th>Embedded</th></tr></thead>
        <tbody>{(s.byMerchant as any[]).map((m) => (
          <tr key={m.slug}><td>{m.name}</td><td>{m.integration}</td><td>{m.products}</td>
            <td className={m.embedded < m.products ? "warn" : ""}>{m.embedded}</td></tr>
        ))}</tbody>
      </table>

      <h2 className="h2">Recent catalogue imports</h2>
      <table className="tbl">
        <thead><tr><th>Merchant</th><th>Source</th><th>Status</th><th>OK / errors / total</th><th>Started</th></tr></thead>
        <tbody>{(s.imports as any[]).map((i) => (
          <tr key={i.id}><td>{i.slug}</td><td className="mono">{String(i.source).split(/[\\/]/).pop()}</td><td>{i.status}</td>
            <td>{i.rows_ok} / <span className={i.rows_error ? "warn" : ""}>{i.rows_error}</span> / {i.rows_total}</td>
            <td>{fmt(i.started_at)}</td></tr>
        ))}</tbody>
      </table>

      {(s.importErrors as any[]).length > 0 && (
        <>
          <h2 className="h2">Import errors</h2>
          <table className="tbl">
            <thead><tr><th>Row</th><th>Message</th></tr></thead>
            <tbody>{(s.importErrors as any[]).map((e, k) => (
              <tr key={k}><td className="mono">{e.row_ref}</td><td>{e.message}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}

      <h2 className="h2">Top clicked products</h2>
      {(s.topClicked as any[]).length === 0 ? <p className="muted">No clicks yet.</p> : (
        <table className="tbl">
          <thead><tr><th>Product</th><th>Category</th><th>Clicks</th></tr></thead>
          <tbody>{(s.topClicked as any[]).map((p) => (
            <tr key={p.id}><td><Link href={productPath(p.title, p.id)}>{p.title}</Link></td><td>{p.category}</td><td>{p.clicks}</td></tr>
          ))}</tbody>
        </table>
      )}

      <h2 className="h2">AI cost by stage</h2>
      {(s.cost as any[]).length === 0 ? <p className="muted">No AI calls logged yet.</p> : (
        <table className="tbl">
          <thead><tr><th>Stage</th><th>Model</th><th>Calls</th><th>Cost</th><th>Avg latency</th></tr></thead>
          <tbody>{(s.cost as any[]).map((r, k) => (
            <tr key={k}><td>{r.stage}</td><td className="mono">{r.model}</td><td>{r.calls}</td><td>{usd(r.cost_usd)}</td><td>{r.avg_ms} ms</td></tr>
          ))}</tbody>
        </table>
      )}
    </main>
  );
}

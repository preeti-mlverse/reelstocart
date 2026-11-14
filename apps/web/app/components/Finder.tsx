"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { productPath, formatInr } from "@/lib/site";

type Attr = { value: unknown; confidence?: number } | undefined;
interface Product {
  id: string; db_id?: string; title: string; image: string; product_url: string;
  price_inr?: number; mrp_inr?: number; merchant: string; availability?: string;
}
interface Match {
  product: Product;
  score: number;
  match_label: string;
  explanation: { similarities: string[]; differences: string[]; hard_mismatches: string[] };
  stale_stock: boolean;
}
interface Garment { garment_id: string; category: string; attributes: Record<string, Attr> }
interface GarmentResult { garment: Garment; matches: Match[] }
interface Look {
  items: { slot: string; category: string; match: Match }[];
  total_inr: number; budget_inr: number; coverage: number; missing_slots: string[]; within_budget: boolean;
}
interface ImageOutput {
  model: { name: string; mode: string }; cost_usd: number; warnings: string[];
  retrieval: string; job_id: string | null; results: GarmentResult[]; look: Look | null;
}
interface Outfit {
  outfit_id: string; timestamp: number; scene_change: boolean;
  representative_frame_b64: string; image_quality: number; garments: GarmentResult[];
}
interface VideoOutput {
  model: { name: string; mode: string }; cost_usd: number; warnings: string[]; job_id: string | null;
  frames_selected: { t: number; scene_change: boolean }[]; outfits: Outfit[];
}

const attrStr = (a: Attr) => (a && typeof a.value === "string" && a.value !== "unknown" ? a.value.replace(/_/g, " ") : null);

function outHref(p: Product, jobId: string | null) {
  if (!p.db_id) return p.product_url;
  return `/go/${p.db_id}${jobId ? `?j=${jobId}` : ""}`;
}

function MatchCard({ m, jobId }: { m: Match; jobId: string | null }) {
  const p = m.product;
  return (
    <div className="card">
      <img src={p.image} alt={p.title} loading="lazy" decoding="async" width={300} height={400} />
      <div className="body">
        <span className={`chip label-${m.match_label}`}>{m.match_label.replace(/_/g, " ").toLowerCase()}</span>
        <div className="title" style={{ marginTop: 6 }}>{p.title}</div>
        <div className="price">
          {formatInr(p.price_inr)}
          {p.mrp_inr && p.mrp_inr > (p.price_inr ?? 0) ? <span className="mrp">{formatInr(p.mrp_inr)}</span> : null}
        </div>
        {m.stale_stock && <div className="stale">stock unverified</div>}
        {m.explanation.similarities.length > 0 && (
          <div className="why">✓ {m.explanation.similarities.slice(0, 3).join(", ")}</div>
        )}
        {m.explanation.differences.length > 0 && (
          <div className="why">✕ {m.explanation.differences.slice(0, 2).join(", ")}</div>
        )}
        <div className="card-links">
          <a href={outHref(p, jobId)} target="_blank" rel="sponsored nofollow noopener noreferrer">
            Buy at {p.merchant} →
          </a>
          {p.db_id && <Link href={productPath(p.title, p.db_id)} className="sub-link">Details</Link>}
        </div>
      </div>
    </div>
  );
}

function MatchGrid({ r, jobId }: { r: GarmentResult; jobId: string | null }) {
  const a = r.garment.attributes;
  const desc = [attrStr(a.primary_color), attrStr(a.pattern), attrStr(a.silhouette), attrStr(a.neckline), attrStr(a.sleeve_type)]
    .filter(Boolean).join(" · ");
  return (
    <div className="garment">
      <div className="garment-head">
        <h3 className="garment-title">{r.garment.category.replace(/_/g, " ")}</h3>
        <span className="chip">{r.matches.length} matches</span>
      </div>
      <p className="attrs">{desc}</p>
      {r.matches.length === 0 && <p className="muted">No reliable match in the catalogue yet.</p>}
      <div className="grid">
        {r.matches.slice(0, 8).map((m) => <MatchCard key={m.product.db_id ?? m.product.id} m={m} jobId={jobId} />)}
      </div>
    </div>
  );
}

function LookPanel({ look, jobId }: { look: Look; jobId: string | null }) {
  return (
    <div className="look">
      <div className="look-head">
        <h3 className="garment-title">Complete look within {formatInr(look.budget_inr)}</h3>
        <span className={`chip ${look.within_budget ? "label-VERY_CLOSE" : ""}`}>
          {formatInr(look.total_inr)} total · {Math.round(look.coverage * 100)}% of pieces
        </span>
      </div>
      {look.missing_slots.length > 0 && (
        <p className="muted">No in-budget match for: {look.missing_slots.join(", ").replace(/_/g, " ")}.</p>
      )}
      <div className="grid">
        {look.items.map((i) => <MatchCard key={i.slot} m={i.match} jobId={jobId} />)}
      </div>
    </div>
  );
}

export default function Finder() {
  const [tab, setTab] = useState<"photo" | "video">("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [img, setImg] = useState<ImageOutput | null>(null);
  const [video, setVideo] = useState<VideoOutput | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() { setImg(null); setVideo(null); setSelected(null); setError(null); }
  function switchTab(t: "photo" | "video") { setTab(t); setFile(null); setPreview(null); reset(); }

  function pick(f: File | null) {
    if (!f) return;
    setFile(f); reset(); setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setLoading(true); reset();
    try {
      const form = new FormData();
      form.append("file", file);
      if (maxPrice) form.append("max_price_inr", maxPrice);
      if (budget) form.append("budget_inr", budget);
      const url = tab === "video" ? "/api/analyze-video" : "/api/analyze";
      const res = await fetch(url, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
      if (tab === "video") {
        setVideo(json);
        setSelected(json.outfits?.[0]?.outfit_id ?? null);
      } else {
        setImg(json);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const accept = tab === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp";
  const activeOutfit = video?.outfits.find((o) => o.outfit_id === selected) ?? null;

  return (
    <section id="finder" className="finder" aria-label="Outfit finder">
      <div className="tabs" role="tablist" aria-label="Media type">
        <button role="tab" aria-selected={tab === "photo"} className={`tab ${tab === "photo" ? "active" : ""}`} onClick={() => switchTab("photo")}>Photo</button>
        <button role="tab" aria-selected={tab === "video"} className={`tab ${tab === "video" ? "active" : ""}`} onClick={() => switchTab("video")}>Video</button>
      </div>

      <div className="drop" role="button" tabIndex={0}
           onClick={() => inputRef.current?.click()}
           onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] ?? null); }}>
        <input ref={inputRef} type="file" accept={accept} aria-label={tab === "video" ? "Choose a video" : "Choose an image"}
               onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {preview
          ? (tab === "video"
              ? <video className="preview" src={preview} controls muted style={{ maxHeight: 320 }} />
              : <img className="preview" src={preview} alt="Your uploaded outfit" />)
          : <span className="muted">
              {tab === "video" ? "Tap or drop a short video (MP4 / WebM / MOV)" : "Tap or drop a screenshot or photo (JPG / PNG / WebP)"}
            </span>}
      </div>

      <div className="row">
        <label className="field">
          <span>Max per item</span>
          <input className="input" type="number" inputMode="numeric" placeholder="₹ any" value={maxPrice}
                 onChange={(e) => setMaxPrice(e.target.value)} style={{ width: 120 }} />
        </label>
        {tab === "photo" && (
          <label className="field">
            <span>Total look budget</span>
            <input className="input" type="number" inputMode="numeric" placeholder="₹ optional" value={budget}
                   onChange={(e) => setBudget(e.target.value)} style={{ width: 130 }} />
          </label>
        )}
        <button className="btn" onClick={analyze} disabled={!file || loading}>
          {loading ? (tab === "video" ? "Extracting frames…" : "Analysing…") : "Find the look"}
        </button>
      </div>

      {error && <div className="err" role="alert">⚠️ {error}</div>}

      {img && (
        <div aria-live="polite">
          <p className="muted">
            {img.results.length} garment(s) detected · model {img.model.name}
            {img.warnings?.length ? ` · ${img.warnings.join("; ")}` : ""}
          </p>
          {img.results.length === 0 && <p className="muted">No garments detected in this image. Try a clearer, full-outfit shot.</p>}
          {img.look && <LookPanel look={img.look} jobId={img.job_id} />}
          {img.results.map((r) => <MatchGrid key={r.garment.garment_id} r={r} jobId={img.job_id} />)}
        </div>
      )}

      {video && (
        <div aria-live="polite">
          <p className="muted">
            {video.frames_selected.length} frames sampled · {video.outfits.length} outfit(s) · model {video.model.name}
          </p>
          {video.outfits.length === 0 && <p className="muted">No usable outfits detected in this video.</p>}
          {video.outfits.length > 0 && (
            <>
              <h3 className="section-title">Which outfit?</h3>
              <p className="steps">We found {video.outfits.length} distinct outfit(s). Pick one to shop its pieces.</p>
              <div className="outfits">
                {video.outfits.map((o) => (
                  <button key={o.outfit_id} type="button"
                          className={`outfit-thumb ${o.outfit_id === selected ? "active" : ""}`}
                          onClick={() => setSelected(o.outfit_id)}>
                    <img src={`data:image/jpeg;base64,${o.representative_frame_b64}`} alt={`Outfit at ${o.timestamp}s`} />
                    <div className="cap">
                      <b>{o.garments.map((g) => g.garment.category.replace(/_/g, " ")).join(" + ") || "outfit"}</b>
                      <div>t={o.timestamp}s{o.scene_change ? <span className="scene-tag">scene</span> : null}</div>
                    </div>
                  </button>
                ))}
              </div>
              {activeOutfit && (
                <>
                  <h3 className="section-title">Shop this look</h3>
                  {activeOutfit.garments.map((r) => <MatchGrid key={r.garment.garment_id} r={r} jobId={video.job_id} />)}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

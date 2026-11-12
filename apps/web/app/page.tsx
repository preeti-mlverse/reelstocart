"use client";
import { useRef, useState } from "react";

type Attr = { value: unknown; confidence?: number } | undefined;
interface Match {
  product: {
    id: string; title: string; image: string; product_url: string;
    price_inr?: number; mrp_inr?: number; merchant: string; availability?: string;
  };
  score: number;
  match_label: string;
  explanation: { similarities: string[]; differences: string[]; hard_mismatches: string[] };
  stale_stock: boolean;
}
interface Garment { garment_id: string; category: string; attributes: Record<string, Attr> }
interface GarmentResult { garment: Garment; matches: Match[] }
interface ImageOutput { model: { name: string; mode: string }; cost_usd: number; warnings: string[]; results: GarmentResult[] }
interface Outfit {
  outfit_id: string; timestamp: number; scene_change: boolean;
  representative_frame_b64: string; image_quality: number; garments: GarmentResult[];
}
interface VideoOutput {
  model: { name: string; mode: string }; cost_usd: number; warnings: string[];
  frames_selected: { t: number; scene_change: boolean }[]; outfits: Outfit[];
}

const attrStr = (a: Attr) => (a && typeof a.value === "string" ? a.value : null);

function MatchGrid({ r }: { r: GarmentResult }) {
  const a = r.garment.attributes;
  const desc = [attrStr(a.primary_color), attrStr(a.pattern), attrStr(a.silhouette), r.garment.category]
    .filter(Boolean).join(" · ");
  return (
    <div className="garment">
      <div className="garment-head">
        <strong style={{ textTransform: "capitalize" }}>{r.garment.category}</strong>
        <span className="chip">{r.matches.length} matches</span>
      </div>
      <p className="attrs">{desc}</p>
      {r.matches.length === 0 && <p className="muted">No reliable match in the sample catalogue.</p>}
      <div className="grid">
        {r.matches.slice(0, 8).map((m) => (
          <div className="card" key={m.product.id}>
            <img src={m.product.image} alt={m.product.title} />
            <div className="body">
              <span className={`chip label-${m.match_label}`}>{m.match_label.replace(/_/g, " ")}</span>
              <div className="title" style={{ marginTop: 6 }}>{m.product.title}</div>
              <div className="price">
                {m.product.price_inr != null ? `₹${m.product.price_inr}` : "—"}
                {m.product.mrp_inr && m.product.mrp_inr > (m.product.price_inr ?? 0)
                  ? <span className="mrp">₹{m.product.mrp_inr}</span> : null}
              </div>
              {m.stale_stock && <div className="stale">stock unverified</div>}
              {m.explanation.similarities.length > 0 && (
                <div className="why">✓ {m.explanation.similarities.slice(0, 3).join(", ")}</div>
              )}
              {m.explanation.differences.length > 0 && (
                <div className="why">✕ {m.explanation.differences.slice(0, 2).join(", ")}</div>
              )}
              <a href={m.product.product_url} target="_blank" rel="noopener noreferrer">View at {m.product.merchant} →</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"photo" | "video">("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
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
    <main className="wrap">
      <h1 className="h1">Reel-to-Cart</h1>
      <p className="sub">Find the outfit from a photo or a short video.</p>

      <div className="tabs" role="tablist">
        <button className={`tab ${tab === "photo" ? "active" : ""}`} onClick={() => switchTab("photo")}>Photo</button>
        <button className={`tab ${tab === "video" ? "active" : ""}`} onClick={() => switchTab("video")}>Video</button>
      </div>

      <div className="banner">
        Prototype: product results come from a <strong>sample catalogue</strong> (fixture data), not live
        merchant inventory. Detection uses a real vision model on your uploaded media only.
      </div>

      <div className="drop" onClick={() => inputRef.current?.click()}
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] ?? null); }}>
        <input ref={inputRef} type="file" accept={accept}
               onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {preview
          ? (tab === "video"
              ? <video className="preview" src={preview} controls muted style={{ maxHeight: 320 }} />
              : <img className="preview" src={preview} alt="preview" />)
          : <span className="muted">
              {tab === "video" ? "Tap to choose a short video (MP4 / WebM / MOV)" : "Tap to choose an image (JPG / PNG / WebP)"}
            </span>}
      </div>

      <div className="row">
        <input className="input" type="number" placeholder="Max price ₹" value={maxPrice}
               onChange={(e) => setMaxPrice(e.target.value)} style={{ width: 130 }} />
        <button className="btn" onClick={analyze} disabled={!file || loading}>
          {loading ? (tab === "video" ? "Extracting frames…" : "Analysing…") : "Find the look"}
        </button>
      </div>

      {error && <div className="err">⚠️ {error}</div>}

      {/* ---------- Photo results ---------- */}
      {img && (
        <section>
          <p className="muted">
            Model: {img.model.name} ({img.model.mode}) · est. cost ${img.cost_usd.toFixed(4)}
            {img.warnings?.length ? ` · ${img.warnings.join("; ")}` : ""}
          </p>
          {img.results.length === 0 && <p className="muted">No garments detected in this image.</p>}
          {img.results.map((r) => <MatchGrid key={r.garment.garment_id} r={r} />)}
        </section>
      )}

      {/* ---------- Video results: outfit selection ---------- */}
      {video && (
        <section>
          <p className="muted">
            Model: {video.model.name} ({video.model.mode}) · {video.frames_selected.length} frames sampled ·
            {" "}{video.outfits.length} outfit(s) · est. cost ${video.cost_usd.toFixed(4)}
          </p>
          {video.outfits.length === 0 && <p className="muted">No usable outfits detected in this video.</p>}
          {video.outfits.length > 0 && (
            <>
              <p className="section-title">Which outfit?</p>
              <p className="steps">We found {video.outfits.length} distinct outfit(s). Pick one to shop its pieces.</p>
              <div className="outfits">
                {video.outfits.map((o) => (
                  <div key={o.outfit_id}
                       className={`outfit-thumb ${o.outfit_id === selected ? "active" : ""}`}
                       onClick={() => setSelected(o.outfit_id)}>
                    <img src={`data:image/jpeg;base64,${o.representative_frame_b64}`} alt={o.outfit_id} />
                    <div className="cap">
                      <b>{o.garments.map((g) => g.garment.category).join(" + ") || "outfit"}</b>
                      <div>t={o.timestamp}s{o.scene_change ? <span className="scene-tag">scene</span> : null}</div>
                    </div>
                  </div>
                ))}
              </div>
              {activeOutfit && (
                <>
                  <p className="section-title">Shop this look</p>
                  {activeOutfit.garments.map((r) => <MatchGrid key={r.garment.garment_id} r={r} />)}
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

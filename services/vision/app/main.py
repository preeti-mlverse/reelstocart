"""Reel-to-Cart vision service (FastAPI).

Endpoints:
  GET  /healthz              -> mode, strategy, model registry
  POST /v1/analyze/image     -> garments + attributes (multipart file OR {image_base64})
  POST /v1/analyze/video     -> outfits from adaptive frame sampling (multipart file)
"""
from __future__ import annotations
import base64
import tempfile
import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import load_config, mode_problems
from .detectors.registry import build_detector, REGISTRY
from .imaging import validate_and_normalise, make_thumbnail, crop_bbox
from .embedder import build_embedder, Embedder

cfg = load_config()
app = FastAPI(title="Reel-to-Cart Vision", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
_detector = build_detector(cfg)

# Embedder is heavy (loads a model) — build lazily on first use.
_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        _embedder = build_embedder(cfg.mode)
    return _embedder


def _group_outfits(garments: list[dict]) -> list[dict]:
    """Group garments into outfits by person_id (Phase 3 grouping, image-level)."""
    by_person: dict[str, list[dict]] = {}
    for g in garments:
        pid = g.get("person_id") or "p1"
        by_person.setdefault(pid, []).append(g)
    outfits = []
    for i, (pid, items) in enumerate(by_person.items()):
        quality = sum(x.get("confidence", 0.0) for x in items) / max(1, len(items))
        outfits.append({
            "outfit_id": f"o{i+1}",
            "representative_frame": "input",
            "timestamps": [],
            "associated_frames": ["input"],
            "detected_people": [pid],
            "candidate_garments": [x["garment_id"] for x in items],
            "image_quality": round(quality, 3),
            "uncertainty": None if quality >= 0.4 else "low confidence detection",
        })
    return outfits


@app.get("/healthz")
def healthz():
    problems = mode_problems(cfg)
    return {
        "status": "ok" if not problems else "degraded",
        "mode": cfg.mode,
        "detector_strategy": cfg.detector_strategy,
        "problems": problems,
        "models": [m.__dict__ for m in REGISTRY],
    }


class ImageBase64Body(BaseModel):
    image_base64: str
    mime: str | None = None


def _embed_garments(jpeg: bytes, garments: list[dict]) -> str | None:
    """Attach a visual embedding of each garment's crop (Phase 7). Returns the
    embedder name, or None if embedding was unavailable. Never fails the request."""
    if not garments:
        return None
    try:
        emb = get_embedder()
    except Exception as e:  # noqa
        return None
    for g in garments:
        try:
            region = crop_bbox(jpeg, g["bbox"]) if g.get("bbox") else jpeg
            g["embedding"] = emb.embed_image(region)
            g["embedding_model"] = emb.card.name
            g["embedding_dim"] = emb.dim
        except Exception:
            g["embedding"] = None
    return emb.card.name


async def _analyze_bytes(raw: bytes, embed: bool = True):
    try:
        jpeg, mime, (w, h) = validate_and_normalise(raw, cfg.max_image_dimension)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    try:
        result = await _detector.analyze_image(jpeg, mime)
    except RuntimeError as e:
        # Fail loud — never fabricate garments on provider error.
        raise HTTPException(status_code=502, detail={"code": "DETECTOR_ERROR", "message": str(e)})
    embedder_name = _embed_garments(jpeg, result.garments) if embed else None
    outfits = _group_outfits(result.garments)
    return {
        "garments": result.garments,
        "outfits": outfits,
        "image": {"width": w, "height": h},
        "model": result.model,
        "embedder": embedder_name,
        "cost_usd": result.cost_usd,
        "latency_ms": result.latency_ms,
        "warnings": result.warnings,
    }


@app.post("/v1/embed/image")
async def embed_image_endpoint(file: UploadFile = File(...)):
    """Embed a single image (e.g. a product photo) for the catalogue index."""
    raw = await file.read()
    try:
        jpeg, _mime, _size = validate_and_normalise(raw, cfg.max_image_dimension)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    emb = get_embedder()
    vec = emb.embed_image(jpeg)
    return {"embedding": vec, "dim": emb.dim, "model": emb.card.name}


@app.post("/v1/analyze/image")
async def analyze_image(file: UploadFile | None = File(default=None)):
    if file is not None:
        raw = await file.read()
        return await _analyze_bytes(raw)
    raise HTTPException(status_code=400, detail="provide a multipart 'file' or use /v1/analyze/image_b64")


@app.post("/v1/analyze/image_b64")
async def analyze_image_b64(body: ImageBase64Body):
    try:
        raw = base64.b64decode(body.image_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid base64")
    return await _analyze_bytes(raw)


def _outfit_signature(garments: list[dict]) -> str:
    """Stable signature for an outfit so the same look across frames dedupes."""
    parts = []
    for g in garments:
        color = (g.get("attributes", {}).get("primary_color") or {}).get("value")
        parts.append(f"{g.get('category')}:{str(color).lower()}")
    return "|".join(sorted(parts))


@app.post("/v1/analyze/video")
async def analyze_video(file: UploadFile = File(...), max_analyze: int = 4):
    """Phase 3: adaptive frame sampling -> analyse the most informative frames ->
    group into distinct outfits (deduped) each with a representative thumbnail.
    Cost is bounded by max_analyze and the per-search ceiling."""
    from .video import extract_frames  # imported lazily (optional opencv)

    suffix = os.path.splitext(file.filename or "clip.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        frames = extract_frames(tmp_path, max_frames=min(12, cfg.max_video_frames))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    if not frames:
        return {"frames_selected": [], "outfits": [], "cost_usd": 0.0, "mode": cfg.mode,
                "warnings": ["no usable frames extracted"]}

    # Prefer scene-change frames, then sharpest; cap by budget.
    ordered = sorted(frames, key=lambda f: (f.scene_change, f.sharpness), reverse=True)
    to_analyse = ordered[: max(1, min(max_analyze, len(ordered)))]

    outfits: list[dict] = []
    by_sig: dict[str, dict] = {}
    total_cost = 0.0
    warnings: list[str] = []

    for fr in to_analyse:
        if total_cost + _detector.card.est_cost_usd_per_call > cfg.per_search_ceiling_usd:
            warnings.append("per-search cost ceiling reached; stopped analysing further frames")
            break
        res = await _detector.analyze_image(fr.jpeg, "image/jpeg")
        total_cost += res.cost_usd
        if not res.garments:
            continue
        for g in res.garments:
            g["source_frame"] = f"t={round(fr.timestamp, 2)}s"
        sig = _outfit_signature(res.garments)
        quality = sum(g.get("confidence", 0.0) for g in res.garments) / len(res.garments)
        if sig in by_sig:
            # same look seen again — keep the sharper representative frame
            if fr.sharpness > by_sig[sig]["_sharpness"]:
                by_sig[sig]["representative_frame_b64"] = base64.b64encode(make_thumbnail(fr.jpeg)).decode()
                by_sig[sig]["timestamp"] = round(fr.timestamp, 2)
                by_sig[sig]["_sharpness"] = fr.sharpness
            by_sig[sig]["timestamps"].append(round(fr.timestamp, 2))
            continue
        outfit = {
            "outfit_id": f"o{len(outfits) + 1}",
            "timestamp": round(fr.timestamp, 2),
            "timestamps": [round(fr.timestamp, 2)],
            "scene_change": fr.scene_change,
            "representative_frame_b64": base64.b64encode(make_thumbnail(fr.jpeg)).decode(),
            "image_quality": round(quality, 3),
            "garments": res.garments,
            "_sharpness": fr.sharpness,
        }
        by_sig[sig] = outfit
        outfits.append(outfit)

    for o in outfits:
        o.pop("_sharpness", None)

    return {
        "frames_selected": [{"t": round(f.timestamp, 2), "scene_change": f.scene_change,
                             "sharpness": round(f.sharpness, 1)} for f in frames],
        "outfits": outfits,
        "model": {"name": _detector.card.name, "mode": cfg.mode},
        "cost_usd": round(total_cost, 5),
        "mode": cfg.mode,
        "warnings": warnings,
    }

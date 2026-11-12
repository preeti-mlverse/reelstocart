"""Deterministic mock detector — no external spend. Used in DEVELOPMENT_MOCK.
Returns a plausible, clearly-labelled fake so the UI can be exercised without
claiming real analysis."""
from __future__ import annotations
import hashlib
from .base import GarmentDetector, DetectionResult, ModelCard
from ..taxonomy import TAXONOMY_VERSION


def _attr(value, conf=0.6, evidence="inferred"):
    return {"value": value, "confidence": conf, "evidence": evidence, "unknown": value is None}


class MockDetector(GarmentDetector):
    card = ModelCard(
        name="mock-detector", version="1", provider="local", license="n/a",
        hardware="cpu", est_cost_usd_per_call=0.0, typical_latency_ms=5,
        notes="Deterministic placeholder. NOT a real analysis.",
    )

    async def analyze_image(self, image_bytes: bytes, mime: str) -> DetectionResult:
        h = hashlib.sha256(image_bytes).hexdigest()
        # pick a category deterministically from the hash so results are stable
        cats = ["dress", "top", "shirt", "skirt", "jeans", "co_ord_set", "jacket"]
        colors = ["black", "white", "red", "blue", "beige", "green", "pink"]
        cat = cats[int(h[:2], 16) % len(cats)]
        color = colors[int(h[2:4], 16) % len(colors)]
        garment = {
            "garment_id": "g1",
            "category": cat,
            "bbox": [0.2, 0.15, 0.6, 0.7],
            "confidence": 0.5,
            "occlusion": False,
            "attributes": {
                "category": _attr(cat, 0.5),
                "primary_color": _attr(color, 0.5),
                "pattern": _attr("solid", 0.5),
                "silhouette": _attr("fitted", 0.4),
                "taxonomy_version": TAXONOMY_VERSION,
            },
        }
        return DetectionResult(
            garments=[garment],
            model={"name": self.card.name, "version": self.card.version,
                   "provider": "local", "mode": "DEVELOPMENT_MOCK"},
            cost_usd=0.0, latency_ms=5,
            warnings=["MOCK MODE: results are placeholders, not a real analysis."],
        )

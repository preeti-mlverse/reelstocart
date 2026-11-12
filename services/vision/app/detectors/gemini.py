"""Gemini VLM garment detector (Phase 4 Strategy A + Phase 5 attributes).

Calls the Google Generative Language REST API directly (no SDK pin) and asks for
STRICT JSON. The prompt forbids fabrication: anything not visible is marked
unknown with low confidence. oEmbed/metadata are never used here — only pixels.
"""
from __future__ import annotations
import base64
import json
import time

import httpx

from .base import GarmentDetector, DetectionResult, ModelCard
from ..taxonomy import (
    TAXONOMY_VERSION, LAUNCH_CATEGORIES, NECKLINES, SLEEVE_TYPES, SLEEVE_LENGTHS,
    SILHOUETTES, PATTERNS, GARMENT_LENGTHS, STYLE_FAMILIES,
)

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Conservative per-call cost estimate for flash-lite tier (image + ~800 out tokens).
# Real spend is recorded by the caller; this is a budgeting estimate only.
EST_COST_USD = 0.0012

PROMPT = f"""You are a fashion vision analyst. Look ONLY at the image and identify
distinct clothing garments worn by people. Focus on these launch categories:
{", ".join(LAUNCH_CATEGORIES)}.

Rules:
- Analyse ONLY what is visibly present. NEVER invent details you cannot see.
- If an attribute is not clearly visible, set its value to null, unknown=true, low confidence.
- evidence must be "visible" (seen in pixels) or "inferred" (reasoned, not directly seen).
- Separate garments per person; if multiple people, include all, each garment tagged with person_id.
- bbox is [x, y, w, h] normalised 0..1 relative to the image.
- Do not guess exact fabric composition, brand, size, or price from the image.

Return STRICT JSON ONLY, matching this shape:
{{
  "garments": [
    {{
      "garment_id": "g1",
      "person_id": "p1",
      "category": "<one of: {', '.join(LAUNCH_CATEGORIES)}>",
      "bbox": [x, y, w, h],
      "confidence": 0.0,
      "occlusion": false,
      "attributes": {{
        "category":       {{"value": "...", "confidence": 0.0, "evidence": "visible", "unknown": false}},
        "primary_color":  {{"value": "...", "confidence": 0.0, "evidence": "visible", "unknown": false}},
        "secondary_color":{{"value": null,  "confidence": 0.0, "evidence": "inferred", "unknown": true}},
        "pattern":        {{"value": "<{'|'.join(PATTERNS)}>", "confidence": 0.0, "evidence": "visible", "unknown": false}},
        "neckline":       {{"value": "<{'|'.join(NECKLINES)}>", "confidence": 0.0, "evidence": "visible", "unknown": false}},
        "sleeve_type":    {{"value": "<{'|'.join(SLEEVE_TYPES)}>", "confidence": 0.0, "evidence": "visible", "unknown": false}},
        "sleeve_length":  {{"value": "<{'|'.join(SLEEVE_LENGTHS)}>", "confidence": 0.0, "evidence": "visible", "unknown": false}},
        "silhouette":     {{"value": "<{'|'.join(SILHOUETTES)}>", "confidence": 0.0, "evidence": "inferred", "unknown": false}},
        "garment_length": {{"value": "<{'|'.join(GARMENT_LENGTHS)}>", "confidence": 0.0, "evidence": "inferred", "unknown": false}},
        "style_family":   {{"value": "<{'|'.join(STYLE_FAMILIES)}>", "confidence": 0.0, "evidence": "inferred", "unknown": false}},
        "fabric_appearance": {{"value": null, "confidence": 0.0, "evidence": "inferred", "unknown": true}}
      }}
    }}
  ]
}}
If no garment is visible, return {{"garments": []}}."""


class GeminiDetector(GarmentDetector):
    def __init__(self, api_key: str, model: str):
        self._key = api_key
        self._model = model
        self.card = ModelCard(
            name=model, version="v1beta", provider="google",
            license="Google API ToS", hardware="hosted",
            est_cost_usd_per_call=EST_COST_USD, typical_latency_ms=1800,
            notes="VLM structured garment detection + attributes (Strategy A).",
        )

    async def analyze_image(self, image_bytes: bytes, mime: str) -> DetectionResult:
        t0 = time.monotonic()
        body = {
            "contents": [{
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": mime, "data": base64.b64encode(image_bytes).decode()}},
                ],
            }],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        }
        url = ENDPOINT.format(model=self._model)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers={"x-goog-api-key": self._key}, json=body)
        latency_ms = int((time.monotonic() - t0) * 1000)

        if resp.status_code != 200:
            # Fail loud: surface the provider error, do not fabricate garments.
            raise RuntimeError(f"gemini_http_{resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            raise RuntimeError(f"gemini_bad_response: {e}: {str(data)[:300]}")

        garments = parsed.get("garments", [])
        warnings: list[str] = []
        for i, g in enumerate(garments):
            g.setdefault("garment_id", f"g{i+1}")
            g.setdefault("occlusion", False)
            g.setdefault("confidence", 0.5)
            attrs = g.setdefault("attributes", {})
            attrs["taxonomy_version"] = TAXONOMY_VERSION
            cat = g.get("category")
            if cat not in LAUNCH_CATEGORIES:
                warnings.append(f"garment {g['garment_id']} category '{cat}' not in launch set")

        return DetectionResult(
            garments=garments,
            model={"name": self._model, "version": "v1beta", "provider": "google", "mode": "REAL_HOSTED"},
            cost_usd=EST_COST_USD, latency_ms=latency_ms, warnings=warnings,
        )

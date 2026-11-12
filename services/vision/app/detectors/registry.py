"""Model registry (Phase 4): records each available detector's card and builds
the active one from config."""
from __future__ import annotations
from .base import GarmentDetector, ModelCard
from .mock import MockDetector
from .gemini import GeminiDetector
from ..config import Config

# Declared strategies (A/B/C). B and C are registered as cards but BLOCKED until
# weights/licence/runtime are provisioned — never silently substituted.
REGISTRY: list[ModelCard] = [
    MockDetector.card,
    ModelCard(name="gemini-vlm", version="v1beta", provider="google", license="Google API ToS",
              hardware="hosted", est_cost_usd_per_call=0.0012, typical_latency_ms=1800,
              notes="Strategy A — structured VLM detection."),
    ModelCard(name="grounding-dino+sam2", version="pending", provider="open-weight",
              license="Apache-2.0 / check SAM2", hardware="gpu", est_cost_usd_per_call=0.0,
              typical_latency_ms=1200, notes="Strategy B — BLOCKED: needs weights + GPU."),
    ModelCard(name="sam3", version="pending", provider="open-weight", license="check",
              hardware="gpu", est_cost_usd_per_call=0.0, typical_latency_ms=1500,
              notes="Strategy C — BLOCKED: model access/licence/runtime."),
]


def build_detector(cfg: Config) -> GarmentDetector:
    strategy = cfg.detector_strategy
    if strategy == "gemini" and cfg.gemini_api_key:
        return GeminiDetector(cfg.gemini_api_key, cfg.gemini_model)
    return MockDetector()

"""Visual embedding providers (Phase 7). Swappable per the model registry.

- FashionClipEmbedder: open-weight FashionCLIP (patrickjohncyh/fashion-clip),
  CPU-friendly, 512-d, fashion-tuned. Loaded lazily so the service boots without
  torch installed.
- MockEmbedder: deterministic hash -> unit vector (DEVELOPMENT_MOCK). Clearly not
  a real visual signal.

Benchmark target (Phase 13): SigLIP 2 vs FashionCLIP — swap the provider here.
"""
from __future__ import annotations
import hashlib
import math
from abc import ABC, abstractmethod
from io import BytesIO

from .detectors.base import ModelCard

EMBED_DIM = 512


class Embedder(ABC):
    card: ModelCard
    dim: int

    @abstractmethod
    def embed_image(self, image_bytes: bytes) -> list[float]:
        ...


class MockEmbedder(Embedder):
    dim = EMBED_DIM
    card = ModelCard(
        name="mock-embedder", version="1", provider="local", license="n/a",
        hardware="cpu", est_cost_usd_per_call=0.0, typical_latency_ms=1,
        notes="Deterministic hash vector. NOT a real visual embedding.",
    )

    def embed_image(self, image_bytes: bytes) -> list[float]:
        # Expand a sha256 digest into a stable pseudo-vector, then L2-normalise.
        seed = hashlib.sha256(image_bytes).digest()
        vals: list[float] = []
        i = 0
        while len(vals) < self.dim:
            h = hashlib.sha256(seed + i.to_bytes(4, "big")).digest()
            for b in h:
                vals.append((b / 255.0) - 0.5)
                if len(vals) >= self.dim:
                    break
            i += 1
        norm = math.sqrt(sum(v * v for v in vals)) or 1.0
        return [v / norm for v in vals]


class FashionClipEmbedder(Embedder):
    dim = EMBED_DIM
    card = ModelCard(
        name="fashion-clip", version="patrickjohncyh/fashion-clip", provider="open-weight",
        license="MIT", hardware="cpu/gpu", est_cost_usd_per_call=0.0, typical_latency_ms=180,
        notes="CLIP ViT-B/32 fine-tuned on fashion. 512-d image embeddings.",
    )

    def __init__(self, model_id: str = "patrickjohncyh/fashion-clip"):
        # Heavy imports kept local so the service runs without torch.
        import torch  # noqa
        from transformers import CLIPModel, CLIPProcessor  # noqa

        self._torch = torch
        self._model = CLIPModel.from_pretrained(model_id)
        self._model.eval()
        self._proc = CLIPProcessor.from_pretrained(model_id)

    def embed_image(self, image_bytes: bytes) -> list[float]:
        from PIL import Image

        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        inputs = self._proc(images=img, return_tensors="pt")
        with self._torch.no_grad():
            feats = self._model.get_image_features(**inputs)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        return feats[0].tolist()


def build_embedder(mode: str) -> Embedder:
    """Mock in DEVELOPMENT_MOCK; otherwise try FashionCLIP, fall back to mock loudly."""
    if mode == "DEVELOPMENT_MOCK":
        return MockEmbedder()
    try:
        return FashionClipEmbedder()
    except Exception as e:  # torch/model not available
        print(f"[embedder] FashionCLIP unavailable ({e}); using mock embedder")
        return MockEmbedder()


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))  # inputs are L2-normalised

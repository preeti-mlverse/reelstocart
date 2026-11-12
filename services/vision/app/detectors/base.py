"""Garment detector interface + model registry entry (Phase 4)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ModelCard:
    name: str
    version: str
    provider: str
    license: str
    hardware: str
    est_cost_usd_per_call: float
    typical_latency_ms: int
    notes: str = ""


@dataclass
class DetectionResult:
    garments: list[dict]
    model: dict
    cost_usd: float = 0.0
    latency_ms: int = 0
    warnings: list[str] = field(default_factory=list)


class GarmentDetector(ABC):
    """A pluggable garment-detection + attribute-extraction strategy."""

    card: ModelCard

    @abstractmethod
    async def analyze_image(self, image_bytes: bytes, mime: str) -> DetectionResult:
        ...

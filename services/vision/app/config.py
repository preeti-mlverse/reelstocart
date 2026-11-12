"""Vision service configuration. Reads env once; fails loudly on bad mode."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    mode: str
    gemini_api_key: str | None
    gemini_model: str
    openai_api_key: str | None
    max_image_dimension: int
    max_video_duration_seconds: int
    max_video_frames: int
    per_search_ceiling_usd: float

    @property
    def detector_strategy(self) -> str:
        """Which detector to use given mode + credentials."""
        if self.mode == "DEVELOPMENT_MOCK":
            return "mock"
        if self.gemini_api_key:
            return "gemini"
        return "mock"


def load_config() -> Config:
    return Config(
        mode=os.getenv("RTC_MODE", "DEVELOPMENT_MOCK"),
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        max_image_dimension=int(os.getenv("MAX_IMAGE_DIMENSION", "8000")),
        max_video_duration_seconds=int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "120")),
        max_video_frames=int(os.getenv("MAX_VIDEO_FRAMES", "1800")),
        per_search_ceiling_usd=float(os.getenv("COST_PER_SEARCH_CEILING_USD", "0.25")),
    )


def mode_problems(cfg: Config) -> list[str]:
    problems: list[str] = []
    if cfg.mode == "REAL_HOSTED" and not (cfg.gemini_api_key or cfg.openai_api_key):
        problems.append("REAL_HOSTED requires GEMINI_API_KEY or OPENAI_API_KEY")
    return problems

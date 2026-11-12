"""Scene-change-aware frame sampling (Phase 3).

Not fixed-rate: we sample 1–2 fps as a base and add extra frames where the scene
changes, then drop near-duplicate and blurry frames. Returns selected frames with
timestamps. OpenCV is optional; if missing, the endpoint reports clearly.
"""
from __future__ import annotations
from dataclasses import dataclass

try:
    import cv2  # type: ignore
    import numpy as np  # type: ignore
    _CV2 = True
except Exception:  # pragma: no cover - optional dep
    _CV2 = False


@dataclass
class Frame:
    index: int
    timestamp: float
    jpeg: bytes
    sharpness: float
    scene_change: bool


def _sharpness(gray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def extract_frames(path: str, max_frames: int = 12, base_fps: float = 1.5,
                   scene_threshold: float = 28.0, blur_floor: float = 40.0) -> list[Frame]:
    """Adaptive sampling. Returns at most `max_frames` informative frames."""
    if not _CV2:
        raise RuntimeError("opencv_not_installed: install opencv-python-headless for video analysis")

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise RuntimeError("video_open_failed")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, int(round(fps / base_fps)))

    selected: list[Frame] = []
    prev_small = None
    last_hist = None
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        take = (idx % step == 0)
        scene_change = False
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (64, 64))
        if prev_small is not None:
            diff = float(np.mean(cv2.absdiff(small, prev_small)))
            if diff > scene_threshold:
                scene_change = True
                take = True
        prev_small = small

        if take:
            sharp = _sharpness(gray)
            if sharp < blur_floor and not scene_change:
                idx += 1
                continue
            # near-duplicate suppression via colour histogram
            hist = cv2.calcHist([frame], [0, 1, 2], None, [8, 8, 8], [0, 256] * 3)
            cv2.normalize(hist, hist)
            if last_hist is not None:
                sim = cv2.compareHist(last_hist, hist, cv2.HISTCMP_CORREL)
                if sim > 0.985 and not scene_change:
                    idx += 1
                    continue
            last_hist = hist
            ok2, buf = cv2.imencode(".jpg", frame)
            if ok2:
                selected.append(Frame(idx, idx / fps, buf.tobytes(), sharp, scene_change))
                if len(selected) >= max_frames:
                    break
        idx += 1
        if total and idx > total:
            break
    cap.release()
    return selected

"""Safe image handling (Phase 2 security): magic-byte sniff + guarded decode to
stop decompression bombs before heavy processing."""
from __future__ import annotations
from io import BytesIO

from PIL import Image

# Guard against decompression bombs globally.
Image.MAX_IMAGE_PIXELS = 64_000_000  # ~8000x8000

_SIG = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
}


def sniff_mime(buf: bytes) -> str | None:
    if buf[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if buf[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if buf[:4] == b"RIFF" and buf[8:12] == b"WEBP":
        return "image/webp"
    if buf[4:8] == b"ftyp":
        brand = buf[8:12].lower()
        if brand[:3] in (b"hei", b"hev") or brand in (b"mif1", b"msf1"):
            return "image/heic"
    return None


def crop_bbox(jpeg: bytes, bbox, pad: float = 0.04, quality: int = 90) -> bytes:
    """Crop a normalised [x, y, w, h] bbox (0..1) from an image, with small padding.
    Used to embed just the garment region for visual retrieval."""
    img = Image.open(BytesIO(jpeg)).convert("RGB")
    W, H = img.size
    x, y, bw, bh = bbox
    x0 = max(0, int((x - pad) * W)); y0 = max(0, int((y - pad) * H))
    x1 = min(W, int((x + bw + pad) * W)); y1 = min(H, int((y + bh + pad) * H))
    if x1 <= x0 or y1 <= y0:
        x0, y0, x1, y1 = 0, 0, W, H
    out = BytesIO()
    img.crop((x0, y0, x1, y1)).save(out, format="JPEG", quality=quality)
    return out.getvalue()


def make_thumbnail(jpeg_or_any: bytes, width: int = 320, quality: int = 70) -> bytes:
    """Downscale an image to `width` px wide JPEG — keeps base64 payloads small
    for representative outfit frames sent to the UI."""
    img = Image.open(BytesIO(jpeg_or_any)).convert("RGB")
    w, h = img.size
    if w > width:
        img = img.resize((width, max(1, round(h * width / w))))
    out = BytesIO()
    img.save(out, format="JPEG", quality=quality)
    return out.getvalue()


def validate_and_normalise(buf: bytes, max_dim: int) -> tuple[bytes, str, tuple[int, int]]:
    """Returns (jpeg_bytes, mime, (w, h)). Raises on invalid/oversized input."""
    mime = sniff_mime(buf)
    if mime is None:
        raise ValueError("unsupported_or_spoofed_image")
    try:
        img = Image.open(BytesIO(buf))
        img.verify()  # cheap structural check
        img = Image.open(BytesIO(buf))  # re-open after verify
    except Exception as e:  # noqa
        raise ValueError(f"image_decode_failed: {e}")
    w, h = img.size
    if w > max_dim or h > max_dim:
        raise ValueError(f"image_too_large: {w}x{h} exceeds {max_dim}px")
    # normalise everything to JPEG for the VLM
    rgb = img.convert("RGB")
    out = BytesIO()
    rgb.save(out, format="JPEG", quality=90)
    return out.getvalue(), "image/jpeg", (w, h)

"""Phase 13 evaluation helper: build realistic *query* embeddings for catalogue
products by turning each product photo into a reel-style screenshot (9:16 frame,
random off-centre crop, blurred fill, fake UI bars, JPEG q=70), then embedding it
through the running vision service (/v1/embed/image).

Reads  : JSON list [{"id", "category", "image"}] (path argv[1])
Writes : JSON list [{"id", "category", "embedding"}] (path argv[2])
Env    : VISION_SERVICE_URL (default http://localhost:8000), EVAL_SEED (default 7)

No Gemini calls: this measures the visual retrieval stage only.
"""
import io
import json
import os
import random
import sys
import urllib.request
import uuid

from PIL import Image, ImageDraw, ImageFilter

VISION = os.environ.get("VISION_SERVICE_URL", "http://localhost:8000").rstrip("/")
UA = {"User-Agent": "reeltocart-eval/1.0"}


def reelify(src: Image.Image, rng: random.Random) -> bytes:
    W, H = 720, 1280
    bg = src.resize((W, H)).filter(ImageFilter.GaussianBlur(30))
    cw, ch = src.size
    f = rng.uniform(0.82, 0.95)
    x0 = rng.randint(0, int(cw * (1 - f)))
    y0 = rng.randint(0, int(ch * (1 - f)))
    crop = src.crop((x0, y0, x0 + int(cw * f), y0 + int(ch * f)))
    scale = min(W / crop.width, (H - 260) / crop.height)
    crop = crop.resize((max(1, int(crop.width * scale)), max(1, int(crop.height * scale))))
    bg.paste(crop, ((W - crop.width) // 2, 120))
    d = ImageDraw.Draw(bg)
    d.rectangle([0, 0, W, 70], fill=(0, 0, 0))
    d.rectangle([0, H - 150, W, H], fill=(10, 10, 10))
    d.text((24, H - 120), "@creator  get the look #ootd", fill=(255, 255, 255))
    buf = io.BytesIO()
    bg.save(buf, "JPEG", quality=70)
    return buf.getvalue()


def embed(jpeg: bytes) -> list[float]:
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"q.jpg\"\r\n"
        "Content-Type: image/jpeg\r\n\r\n"
    ).encode() + jpeg + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{VISION}/v1/embed/image", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=60).read())["embedding"]


def main(inp: str, out: str) -> None:
    rng = random.Random(int(os.environ.get("EVAL_SEED", "7")))
    items = json.load(open(inp, encoding="utf-8"))
    res, failed = [], 0
    for it in items:
        try:
            raw = urllib.request.urlopen(urllib.request.Request(it["image"], headers=UA), timeout=30).read()
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            res.append({"id": it["id"], "category": it["category"], "embedding": embed(reelify(img, rng))})
        except Exception as e:  # keep going; report count
            failed += 1
            print(f"skip {it['id']}: {e}", file=sys.stderr)
    json.dump(res, open(out, "w", encoding="utf-8"))
    print(json.dumps({"queries": len(res), "failed": failed}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

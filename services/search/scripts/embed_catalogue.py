"""Compute visual embeddings for every seed product image via the running vision
service, and write services/search/data/seed-embeddings.json.

Prereq: vision service up (REAL_LOCAL/REAL_HOSTED so FashionCLIP loads) and
seed images rendered (gen_seed_images.py).

Run:  services/vision/.venv/Scripts/python.exe -I services/search/scripts/embed_catalogue.py
"""
import json
import pathlib
import sys
import httpx

ROOT = pathlib.Path(__file__).resolve().parents[3]
CAT = ROOT / "services" / "search" / "data" / "seed-catalogue.json"
IMG = ROOT / "apps" / "web" / "public" / "seed-images"
OUT = ROOT / "services" / "search" / "data" / "seed-embeddings.json"
VISION = "http://127.0.0.1:8000"


def main():
    products = json.loads(CAT.read_text())["products"]
    embeddings = {}
    model = None
    dim = None
    with httpx.Client(timeout=120) as c:
        for p in products:
            fp = IMG / f"{p['id']}.jpg"
            if not fp.exists():
                print(f"skip {p['id']}: no image at {fp}")
                continue
            r = c.post(f"{VISION}/v1/embed/image", files={"file": (fp.name, fp.read_bytes(), "image/jpeg")})
            r.raise_for_status()
            d = r.json()
            embeddings[p["id"]] = d["embedding"]
            model, dim = d["model"], d["dim"]
            print(f"embedded {p['id']} ({p['category']}/{p.get('color')})")
    OUT.write_text(json.dumps({"model": model, "dim": dim, "embeddings": embeddings}))
    print(f"wrote {len(embeddings)} embeddings (model={model}, dim={dim}) -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())

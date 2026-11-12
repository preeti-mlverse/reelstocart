"""Render simple synthetic garment images for each seed product so visual
embeddings (and the UI cards) share one coherent space.

SAMPLE IMAGERY ONLY — crude silhouettes coloured per product attributes, not real
product photos. Writes apps/web/public/seed-images/<id>.jpg and rewrites the
catalogue's image field to /seed-images/<id>.jpg.

Run:  services/vision/.venv/Scripts/python.exe -I services/search/scripts/gen_seed_images.py
"""
import json
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[3]
CAT = ROOT / "services" / "search" / "data" / "seed-catalogue.json"
OUT = ROOT / "apps" / "web" / "public" / "seed-images"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 400, 600
BG = (248, 248, 250)
COLORS = {
    "black": (40, 40, 44), "white": (240, 240, 242), "red": (200, 40, 50),
    "crimson": (180, 24, 56), "maroon": (120, 26, 42), "blue": (46, 92, 190),
    "navy": (34, 44, 92), "beige": (223, 208, 178), "green": (46, 140, 82),
    "olive": (112, 120, 54), "pink": (232, 134, 162), "rose": (214, 96, 128),
    "grey": (140, 140, 146),
}
SKIN = (228, 198, 170)


def col(name: str | None):
    return COLORS.get((name or "").lower(), (150, 150, 156))


def draw_head(d):
    d.ellipse([180, 40, 220, 88], fill=SKIN)
    d.rectangle([193, 86, 207, 104], fill=SKIN)


def render(product) -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    c = col(product.get("color"))
    cat = product["category"]
    sil = (product.get("silhouette") or "").lower()
    draw_head(d)

    if cat == "dress":
        wide = sil in ("a_line", "flared")
        hem = 150 if wide else 70
        d.polygon([(160, 104), (240, 104), (200 + hem, 470), (200 - hem, 470)], fill=c)
        d.rectangle([188, 470, 198, 560], fill=SKIN); d.rectangle([202, 470, 212, 560], fill=SKIN)
    elif cat in ("top", "shirt"):
        d.rectangle([150, 104, 250, 300], fill=c)
        if cat == "shirt":
            d.polygon([(190, 104), (200, 128), (210, 104)], fill=BG)  # collar notch
        d.rectangle([180, 300, 220, 420], fill=(90, 90, 100))  # neutral bottom
    elif cat in ("jacket", "blazer"):
        d.rectangle([145, 104, 255, 330], fill=c)
        d.polygon([(200, 104), (165, 230), (200, 200)], fill=tuple(max(0, x - 25) for x in c))
        d.polygon([(200, 104), (235, 230), (200, 200)], fill=tuple(max(0, x - 25) for x in c))
    elif cat == "skirt":
        wide = sil in ("a_line", "flared")
        hem = 120 if wide else 60
        d.rectangle([150, 104, 250, 300], fill=(110, 110, 120))  # neutral top
        d.polygon([(165, 300), (235, 300), (200 + hem, 470), (200 - hem, 470)], fill=c)
    elif cat in ("jeans", "trousers"):
        wide = sil in ("wide_leg", "relaxed")
        lw = 60 if wide else 34
        d.rectangle([150, 104, 250, 300], fill=(110, 110, 120))
        d.polygon([(165, 300), (198, 300), (198, 560), (165 - (lw - 34), 560)], fill=c)
        d.polygon([(202, 300), (235, 300), (235 + (lw - 34), 560), (202, 560)], fill=c)
    elif cat == "co_ord_set":
        d.rectangle([152, 104, 248, 280], fill=c)
        d.polygon([(165, 300), (235, 300), (255, 560), (145, 560)], fill=tuple(min(255, x + 12) for x in c))
    else:
        d.rectangle([150, 120, 250, 440], fill=c)
    return img


def main():
    data = json.loads(CAT.read_text())
    for p in data["products"]:
        render(p).save(OUT / f"{p['id']}.jpg", quality=88)
        p["image"] = f"/seed-images/{p['id']}.jpg"
    data["_meta"]["note"] += " Images are synthetic silhouettes (sample), not real photos."
    CAT.write_text(json.dumps(data, indent=2))
    print(f"rendered {len(data['products'])} images -> {OUT}")


if __name__ == "__main__":
    main()

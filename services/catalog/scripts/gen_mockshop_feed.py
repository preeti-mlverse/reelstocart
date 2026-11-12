"""Convert a mock.shop (Shopify public demo) product dump into our JSON feed
format. SAMPLE/demo data with real Shopify CDN images. Infers garment category
from the title; prices are demo USD converted to INR (@ a fixed rate, labelled).

Run:  python gen_mockshop_feed.py <mockshop.json> <out-feed.json>
"""
import json
import re
import sys

USD_TO_INR = 83  # demo conversion; clearly sample data
STOREFRONT = "https://apparel-plus.hydrogen.mock.shop/products/"

# Order matters: more specific keywords first.
CATEGORY_RULES = [
    (r"\bco[-\s]?ord|\bset\b", "co_ord_set"),
    (r"blazer", "blazer"),
    (r"jacket|coat|parka|bomber|trench", "jacket"),
    (r"jean|denim", "jeans"),
    (r"trouser|\bpant|chino", "trousers"),
    (r"skirt", "skirt"),
    (r"shirt", "shirt"),
    (r"dress|gown|frock", "dress"),
    (r"top|tee|t-shirt|tank|cami|camisole|blouse|bodysuit|bralette", "top"),
]


def infer_category(title: str):
    t = title.lower()
    for pat, cat in CATEGORY_RULES:
        if re.search(pat, t):
            return cat
    return None


def main(src, out):
    data = json.load(open(src, encoding="utf-8"))
    edges = data["data"]["products"]["edges"]
    feed = []
    skipped = 0
    for e in edges:
        n = e["node"]
        cat = infer_category(n["title"])
        if not cat:
            skipped += 1
            continue
        gid = n["id"].rsplit("/", 1)[-1]
        opts = {o["name"].lower(): o["values"] for o in n.get("options", [])}
        color = (opts.get("color") or [None])[0]
        sizes = opts.get("size") or []
        price = n.get("priceRange", {}).get("minVariantPrice", {}).get("amount")
        mrp = n.get("compareAtPriceRange", {}).get("maxVariantPrice", {}).get("amount")
        img = (n.get("featuredImage") or {}).get("url")
        if not img:
            skipped += 1
            continue
        avail = any(v["node"].get("availableForSale") for v in n.get("variants", {}).get("edges", []))
        feed.append({
            "source_id": f"ms-{gid}",
            "title": n["title"],
            "category": cat,
            "product_url": STOREFRONT + n.get("handle", ""),
            "image": img,
            "brand": n.get("vendor") or "mock.shop",
            "description": (n.get("description") or "")[:300],
            "color": color or "",
            "sizes": "|".join(sizes),
            "price_inr": round(float(price) * USD_TO_INR) if price else "",
            "mrp_inr": round(float(mrp) * USD_TO_INR) if mrp and float(mrp) > float(price or 0) else "",
            "availability": "in_stock" if avail else "out_of_stock",
        })
    json.dump({"_meta": {"note": "mock.shop demo data (apparel-plus); real Shopify CDN images; "
                         "prices demo USD->INR @83"}, "products": feed}, open(out, "w", encoding="utf-8"), indent=2)
    print(f"wrote {len(feed)} products ({skipped} skipped: non-launch categories) -> {out}")
    from collections import Counter
    print("by category:", dict(Counter(p["category"] for p in feed)))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

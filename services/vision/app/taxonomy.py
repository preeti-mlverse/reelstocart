"""Mirror of the TS taxonomy (packages/schemas/src/taxonomy.ts). Keep in sync."""
TAXONOMY_VERSION = "2026.11.0"

LAUNCH_CATEGORIES = [
    "top", "dress", "shirt", "skirt", "jeans", "trousers", "co_ord_set", "jacket", "blazer",
]
ALL_CATEGORIES = LAUNCH_CATEGORIES + ["footwear", "bag", "jewellery", "accessory"]

NECKLINES = ["crew", "v_neck", "scoop", "sweetheart", "halter", "boat", "square",
             "collared", "off_shoulder", "one_shoulder", "high_neck", "cowl", "unknown"]
SLEEVE_TYPES = ["sleeveless", "cap", "short", "three_quarter", "long", "puff",
                "bell", "balloon", "bishop", "spaghetti_strap", "strapless", "unknown"]
SLEEVE_LENGTHS = ["none", "short", "elbow", "three_quarter", "long", "unknown"]
SILHOUETTES = ["fitted", "relaxed", "oversized", "straight", "a_line", "flared",
               "bodycon", "wide_leg", "cropped", "unknown"]
PATTERNS = ["solid", "stripe", "check", "floral", "polka_dot", "geometric", "animal",
            "abstract", "paisley", "colour_block", "tie_dye", "unknown"]
GARMENT_LENGTHS = ["cropped", "waist", "hip", "thigh", "knee", "midi", "ankle", "floor", "unknown"]
STYLE_FAMILIES = ["casual", "formal", "ethnic", "party", "streetwear", "athleisure",
                  "office", "boho", "minimal", "y2k", "unknown"]

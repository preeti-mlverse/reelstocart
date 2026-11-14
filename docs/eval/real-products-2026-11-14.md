# Real-product end-to-end test — 2026-11-14

Full production chain, nothing mocked: reel-style screenshot → `POST /api/analyze` (Next.js, prod build) →
vision service (**Gemini `gemini-3.5-flash-lite`** garment detection + attributes, **FashionCLIP** crop embedding) →
**pgvector HNSW** ANN (co-ord aware) → hybrid rerank → labels → budget look composer → job/impression logging.

**Inputs.** Real product photos fetched live from public Shopify storefronts on mock.shop:
- 4 products that **are** in our catalogue (`apparel-plus` store): dress, jacket, jeans, co-ord set.
- 2 products that are **not** in our catalogue (`demostore`): a green puffer jacket and a women's T-shirt.

Each photo was re-framed as a phone reel screenshot (9:16 canvas, random 85–95% off-centre crop, blurred fill,
status/caption bars, like/comment icons, JPEG q=70) so the query is never byte-identical to the catalogue image.

## Results (final build)

| Case | Gemini detection | Target rank | Top label | Notes |
|---|---|---|---|---|
| Clay Cotton Dress | dress · brown · solid · A-line | **#1** | VERY_CLOSE (vis 0.924) | |
| Copper Textured Jacket | jacket · brown · solid | **#1** | VERY_CLOSE (vis 0.935) | |
| Chestnut Brown Relaxed Fit Denim Pants | jeans · brown · straight | **#1** | VERY_CLOSE (vis 0.928) | |
| Elegant Loungewear Set (co-ord) | top **+** trousers (split by VLM) | **#1 for both pieces** | SIMILAR (0.815 / 0.842) | Budget ₹15,000 look = the set once, ₹6,225, 100% coverage |
| Green puffer (not in catalogue) | jacket · green · solid | n/a | STYLE_ALTERNATIVE 0.602, rest NO_RELIABLE_MATCH | No false "very close" |
| Women's T-shirt (not in catalogue) | top · green · fitted | n/a | STYLE_ALTERNATIVE (olive co-ord, green tank, sage top) | Colour-family alternatives, honestly labelled |

Cost: $0.0012 per image (Gemini); latency ≈ 3.5–5 s per image after warm-up (first call ≈ 30 s cold start).

## Bugs this test found (and fixed)

1. **Under-confident labels on exact products.** Merchant rows carry fashion colour names ("clay") that the VLM
   reports as "brown"; a single disagreeing attribute out-weighed a 0.93 visual near-duplicate → STYLE_ALTERNATIVE.
   *Fix:* colour **families** (clay/rust/chestnut ∈ brown…), attribute weight scaled by attribute **coverage**, and a
   calibrated visual **near-duplicate** rule (≥ 0.91 ⇒ VERY_CLOSE, never over a hard mismatch).
2. **Co-ord sets unfindable.** The VLM splits a set into top + bottom; the hard category filter excluded
   `co_ord_set`. *Fix:* category compatibility (top/shirt/trousers/skirt ↔ co_ord_set) in ANN + matcher, with a 10%
   discount and an explicit "sold as co ord set" note.
3. **Look composer double-charged a co-ord set** that filled two slots (₹12,450). *Fix:* a product is paid for once;
   the UI shows it once as "top + trousers".
4. **Weak matches promoted** after coverage weighting. *Fix:* evidence floor — visual < 0.6 needs real attribute
   agreement (≥ 0.6 at ≥ 50% coverage) to be shown as a match.

Threshold calibration lives in [`retrieval-latest.md`](retrieval-latest.md) (56 products, Recall@1 100%,
true-match sim p5 0.917 vs best-other p98 0.906).

## Limits of this test
- Query images derive from the catalogue photo (re-framed/compressed), not a different photo of the same garment
  worn by a person. Cross-photo (street → studio) accuracy still needs a labelled benchmark set.
- mock.shop is demo data; catalogue items have sparse attributes (mostly colour), which is exactly the case the
  coverage-weighting fix targets.

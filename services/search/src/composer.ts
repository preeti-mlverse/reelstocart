/**
 * Outfit composition under budget (Phase 9, minimal beam search).
 * Given per-slot shortlists and a total budget, find a coherent combination that
 * fits. Honest: if a slot has no in-budget option, the look is marked incomplete
 * rather than fabricating an item.
 */
import type { ScoredMatch } from "./matcher";

export interface SlotShortlist {
  slot: string; // e.g. "top", "bottom", "dress", "layer"
  essential: boolean;
  options: ScoredMatch[];
}

export interface ComposedOutfit {
  items: { slot: string; match: ScoredMatch }[];
  total_inr: number;
  coverage: number; // fraction of requested slots filled
  merchant_count: number;
  within_budget: boolean;
  missing_slots: string[];
}

export function composeOutfit(
  slots: SlotShortlist[],
  budgetInr: number,
  beamWidth = 8,
): ComposedOutfit {
  // Beam over slots, keeping the best partial combinations by (coverage, score, cost).
  type Partial = { items: { slot: string; match: ScoredMatch }[]; cost: number; score: number };
  let beam: Partial[] = [{ items: [], cost: 0, score: 0 }];

  for (const slot of slots) {
    const next: Partial[] = [];
    const opts = slot.options.filter((o) => o.match_label !== "NO_RELIABLE_MATCH");
    for (const partial of beam) {
      // option: skip this slot (only allowed if not essential)
      if (!slot.essential) next.push(partial);
      for (const opt of opts) {
        const price = opt.product.price_inr ?? 0;
        const cost = partial.cost + price;
        if (cost > budgetInr) continue;
        next.push({
          items: [...partial.items, { slot: slot.slot, match: opt }],
          cost,
          score: partial.score + opt.score,
        });
      }
    }
    // keep best by score then lower cost
    beam = next
      .sort((a, b) => b.score - a.score || a.cost - b.cost)
      .slice(0, beamWidth);
    if (beam.length === 0) beam = [{ items: [], cost: 0, score: 0 }];
  }

  const best = beam[0] ?? { items: [], cost: 0, score: 0 };
  const filled = new Set(best.items.map((i) => i.slot));
  const missing = slots.filter((s) => !filled.has(s.slot)).map((s) => s.slot);
  const merchants = new Set(best.items.map((i) => i.match.product.merchant));
  return {
    items: best.items,
    total_inr: best.cost,
    coverage: slots.length ? filled.size / slots.length : 0,
    merchant_count: merchants.size,
    within_budget: best.cost <= budgetInr,
    missing_slots: missing,
  };
}

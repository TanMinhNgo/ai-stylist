import { type SuggestOutput } from '@stylist/shared';
import type { Candidate } from './stylist.provider';
export function validateSuggestions(
  result: SuggestOutput,
  candidates: Candidate[],
) {
  const allowed = new Map(candidates.map((g) => [g.id, g]));
  const sets = new Set<string>();
  for (const outfit of result.outfits) {
    const key = [...outfit.garmentIds].sort().join(',');
    if (sets.has(key)) throw new Error('Duplicate suggestion');
    sets.add(key);
    const pieces = outfit.garmentIds.map((id) => allowed.get(id));
    if (pieces.some((g) => !g)) throw new Error('Invalid suggestion ID');
    const slots = pieces.map((g) => g!.tags.slot);
    const keys = pieces.map((g) =>
      g!.tags.slot === 'jewelry' ? `jewelry:${g!.tags.type}` : g!.tags.slot,
    );
    if (
      new Set(keys).size !== keys.length ||
      (slots.includes('dress') &&
        (slots.includes('top') || slots.includes('bottom')))
    )
      throw new Error('Conflicting suggestion');
    if (
      !slots.includes('dress') &&
      !(slots.includes('top') && slots.includes('bottom'))
    )
      throw new Error('Incomplete outfit');
  }
  if (result.outfits.length < 3 && !result.message)
    throw new Error('Missing insufficient wardrobe message');
  return result;
}

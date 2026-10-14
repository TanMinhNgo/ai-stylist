import { randomUUID } from 'node:crypto';
import { GarmentTags } from '@stylist/shared';
import { validateSuggestions } from './suggestions';
import { Candidate } from './stylist.provider';
const base = GarmentTags.parse({
  category: 'top',
  type: 'shirt',
  slot: 'top',
  colors: ['white'],
  material: 'cotton',
  formality: 2,
  pattern: 'solid',
  fit: 'regular',
  length: 'regular',
  sleeve: 'long',
  neckline: null,
  rise: null,
  season: ['all'],
  occasions: ['casual'],
});
const top = { id: randomUUID(), tags: base, source: 'user_photo' },
  bottom = {
    id: randomUUID(),
    tags: GarmentTags.parse({
      ...base,
      type: 'jeans',
      category: 'pants',
      slot: 'bottom',
    }),
    source: 'user_photo',
  };
const candidates: Candidate[] = [top, bottom];
it('only accepts complete, owned, distinct combinations with available garments', () => {
  const outfit = { garmentIds: [top.id, bottom.id], reason: 'x' };
  expect(
    validateSuggestions(
      { outfits: [outfit], message: 'Only one combination available' },
      candidates,
    ).outfits,
  ).toHaveLength(1);
  for (const ids of [[top.id], [top.id, randomUUID()], [top.id, top.id]])
    expect(() =>
      validateSuggestions(
        { outfits: [{ ...outfit, garmentIds: ids }], message: 'x' },
        candidates,
      ),
    ).toThrow();
  expect(() =>
    validateSuggestions(
      {
        outfits: [outfit, { ...outfit, garmentIds: [bottom.id, top.id] }],
        message: 'x',
      },
      candidates,
    ),
  ).toThrow();
  expect(() =>
    validateSuggestions({ outfits: [outfit], message: null }, candidates),
  ).toThrow();
  expect(() =>
    validateSuggestions({ outfits: [outfit], message: 'x' }, [top]),
  ).toThrow();
});

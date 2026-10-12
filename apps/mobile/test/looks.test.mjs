import { test } from 'node:test';
import assert from 'node:assert/strict';

import { colorHex, lookFor } from '../src/features/studio/looks.ts';

const tags = (over) => ({ category: 'top', type: 'shirt', slot: 'top', colors: ['white'], length: null, sleeve: null, fit: 'regular', ...over });

test('colour names in Vietnamese and English map to hex, longest phrase first', () => {
  assert.equal(colorHex('Xanh navy'), '#253858');
  assert.equal(colorHex('xanh'), '#4E7CC2');
  assert.equal(colorHex('Navy blue'), '#253858');
  assert.equal(colorHex('be'), '#D9C7AE');
  assert.equal(colorHex('berry'), '#9A958E', 'short words only match whole words');
  assert.equal(colorHex('#AABBCC'), '#aabbcc');
  assert.equal(colorHex(undefined), '#9A958E');
});

test('tops pick sleeve, tuck and collar from type and tags', () => {
  const shirt = lookFor(tags({}));
  assert.equal(shirt.part, 'top');
  assert.equal(shirt.tuck, true);
  assert.equal(shirt.collar, true);
  assert.equal(lookFor(tags({ type: 't_shirt' })).sleeve, 'short');
  assert.equal(lookFor(tags({ type: 'tank_top' })).sleeve, 'none');
  assert.equal(lookFor(tags({ type: 'hoodie', sleeve: 'long' })).hood, true);
});

test('bottoms split skirts from pants with length and width', () => {
  assert.deepEqual(lookFor(tags({ category: 'skirt', type: 'mini_skirt', slot: 'bottom' })).hem, 'mini');
  assert.equal(lookFor(tags({ category: 'skirt', type: 'other_skirt', slot: 'bottom', length: 'maxi' })).hem, 'maxi');
  const wide = lookFor(tags({ category: 'pants', type: 'wide_leg', slot: 'bottom' }));
  assert.equal(wide.part, 'pants');
  assert.ok(wide.wide > 0);
  assert.equal(lookFor(tags({ category: 'pants', type: 'shorts', slot: 'bottom' })).len, 'shorts');
});

test('one-piece and traditional outfits use the dress slot', () => {
  assert.equal(lookFor(tags({ category: 'traditional', type: 'ao_dai', slot: 'dress' })).aodai, true);
  assert.equal(lookFor(tags({ category: 'one_piece', type: 'jumpsuit', slot: 'dress' })).jump, 'full');
  assert.equal(lookFor(tags({ category: 'dress', type: 'maxi_dress', slot: 'dress' })).hem, 'maxi');
});

test('jewelry and tie get simple proxies, unknown neckwear does not', () => {
  for (const type of ['earrings', 'bracelet', 'ring', 'necklace']) assert.equal(lookFor(tags({ category: 'accessory', type, slot: 'jewelry' })).part, type);
  assert.equal(lookFor(tags({ category: 'accessory', type: 'tie', slot: 'neck' })).part, 'tie');
  assert.equal(lookFor(tags({ category: 'accessory', type: 'other', slot: 'neck' })), null);
  assert.equal(lookFor(tags({ category: 'accessory', type: 'cap', slot: 'hat' })).style, 'cap');
});

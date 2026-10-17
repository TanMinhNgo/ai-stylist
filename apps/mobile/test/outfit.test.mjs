import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { lookFor } from '../src/features/studio/looks.ts';
import { looksOf, pickKey, togglePick } from '../src/features/studio/outfit.ts';

const W = (id, slot, type, extra = {}) => ({
  id, label: id, garmentId: null, tryOnAllowed: false,
  tags: { category: 'x', slot, type, colors: ['#111111'], length: null, sleeve: null, fit: 'regular' },
  ...extra,
});
const wear = (...items) => items.reduce(togglePick, {});

test('jewelry pieces of different types are worn together, same type replaces', () => {
  const picks = wear(W('e', 'jewelry', 'earrings'), W('r', 'jewelry', 'ring'), W('b', 'jewelry', 'bracelet'), W('n1', 'jewelry', 'necklace'), W('n2', 'jewelry', 'necklace'));
  assert.deepEqual(Object.keys(picks).sort(), ['jewelry:bracelet', 'jewelry:earrings', 'jewelry:necklace', 'jewelry:ring']);
  assert.equal(picks['jewelry:necklace'].id, 'n2');
  assert.equal(pickKey({ slot: 'hat', type: 'cap' }), 'hat');
});

test('dress replaces top and bottom and the other way round; tapping again removes', () => {
  let picks = wear(W('t', 'top', 'shirt'), W('p', 'bottom', 'jeans'), W('ring', 'jewelry', 'ring'));
  picks = togglePick(picks, W('d', 'dress', 'midi_dress'));
  assert.deepEqual(Object.keys(picks).sort(), ['dress', 'jewelry:ring']);
  picks = togglePick(picks, W('t', 'top', 'shirt'));
  assert.deepEqual(Object.keys(picks).sort(), ['jewelry:ring', 'top']);
  assert.deepEqual(Object.keys(togglePick(picks, W('t', 'top', 'shirt'))), ['jewelry:ring']);
});

test('the mannequin draws one look per worn piece that has a 3D form', () => {
  const picks = wear(W('t', 'top', 'shirt'), W('p', 'bottom', 'jeans'), W('x', 'jewelry', 'other_jewelry'));
  assert.deepEqual(looksOf(picks).map((l) => l.part).sort(), ['pants', 'top']);
  assert.deepEqual(looksOf({}), []);
});

test('every bundled demo piece has a 3D look (and so a cartoon icon)', () => {
  const wardrobe = JSON.parse(readFileSync(new URL('../assets/wardrobe/manifest.json', import.meta.url)));
  const formal = JSON.parse(readFileSync(new URL('../assets/formalwear/manifest.json', import.meta.url)));
  for (const tags of [...wardrobe.items.map((i) => i.lookTags), ...formal.items.flatMap((o) => o.lookTags)]) assert.ok(lookFor(tags), `${tags.slot}/${tags.type}`);
});

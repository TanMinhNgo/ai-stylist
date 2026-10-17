import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { useStudio } from '../src/features/studio/store.ts';
import { casualOutfits, pickKey } from '../src/features/studio/outfit.ts';

test('reset drops the previous user picks and activeJob', () => {
  const tags = { category: 'top', type: 'shirt', slot: 'top', colors: ['white'], length: null, sleeve: null, fit: 'regular' };
  const s = useStudio.getState();
  s.toggle({ id: 'g1', label: 'Áo', tags, garmentId: 'g1', tryOnAllowed: true });
  s.setBody('m');
  s.setOccasion('Tiệc');
  s.setActiveJob({ id: 'j1', modelPhotoId: 'p1', garmentIds: ['g1'], occasion: 'Tiệc' });
  assert.notDeepEqual(useStudio.getState().picks, {});

  useStudio.getState().reset();
  const { body, picks, occasion, activeJob } = useStudio.getState();
  assert.deepEqual({ body, picks, occasion, activeJob }, { body: 'f', picks: {}, occasion: 'Đi làm', activeJob: null });
});

test('all four casual outfits contain valid demo pieces and replace the whole look without switching body', () => {
  const definitions = JSON.parse(readFileSync(new URL('../assets/wardrobe/casual-outfits.json', import.meta.url))).items;
  const manifest = JSON.parse(readFileSync(new URL('../assets/wardrobe/manifest.json', import.meta.url)));
  const items = manifest.items.map((i) => ({ id: `demo:${i.id}`, label: i.label, tags: i.lookTags, garmentId: null, tryOnAllowed: false }));
  const outfits = casualOutfits(definitions, items);
  assert.equal(outfits.length, 4);
  for (const body of ['m', 'f']) for (const outfit of outfits) {
    useStudio.getState().reset();
    useStudio.getState().wearOutfit({ id: 'old-formal', label: 'Old', bodyKey: 'f', members: [{ ...items[0], id: 'old-formal' }] });
    useStudio.getState().setBody(body);
    useStudio.getState().toggle({ ...items[0], id: 'private', garmentId: 'real-id', tryOnAllowed: true });
    useStudio.getState().wearOutfit(outfit);
    const state = useStudio.getState();
    assert.equal(state.body, body);
    assert.deepEqual(state.picks, Object.fromEntries(outfit.members.map((w) => [pickKey(w.tags), w])));
    assert.equal(Object.keys(state.picks).length, 4);
    assert.ok(Object.values(state.picks).every((w) => w.id.startsWith('demo:') && w.garmentId === null && !w.tryOnAllowed));
  }
  useStudio.getState().reset();
});

test('casual definitions refuse missing pieces and real garments', () => {
  const definition = [{ id: 'look', label: 'Look', itemIds: ['missing'] }];
  assert.throws(() => casualOutfits(definition, []), /Missing demo item/);
  assert.throws(() => casualOutfits(definition, [{ id: 'demo:missing', garmentId: 'real', tryOnAllowed: false }]), /Missing demo item/);
});

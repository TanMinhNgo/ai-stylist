import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { covers, pickKey, spriteRect, stagePlan, studioCamera, togglePick } from '../src/features/studio/outfit.ts';

const meta = JSON.parse(readFileSync(new URL('../assets/mannequin/mannequin.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../assets/wardrobe/manifest.json', import.meta.url)));

const sprite = (bodyKeys, bounds = [0, 0, 100, 100]) => ({ source: 1, width: 100, height: 100, bounds, bodyKeys });
const W = (id, slot, type, extra = {}) => ({
  id, label: id, garmentId: null, tryOnAllowed: false, sprite: null,
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

test('front view uses PNGs for this body and leaves those pieces off the 3D body; orbit is all proxy', () => {
  const picks = wear(
    W('both', 'top', 'shirt', { sprite: sprite(['m', 'f']) }),
    W('fOnly', 'bottom', 'jeans', { garmentId: 'g1', sprite: sprite(['f']) }),
    W('none', 'shoes', 'loafers'),
  );
  const f = stagePlan(picks, null, 'f', 'front');
  assert.deepEqual(f.sprites.map((s) => s.key), ['bottom', 'top'], 'back-to-front order');
  assert.deepEqual(f.looks.map((l) => l.part), ['shoes'], 'no proxy under a sprite');
  assert.equal(f.mismatched.length, 0);

  const m = stagePlan(picks, null, 'm', 'front');
  assert.deepEqual(m.sprites.map((s) => s.key), ['top'], 'a PNG made for f is never used on m');
  assert.deepEqual(m.looks.map((l) => l.part).sort(), ['pants', 'shoes']);
  assert.deepEqual(m.mismatched.map((w) => w.id), ['fOnly']);

  const orbit = stagePlan(picks, null, 'f', 'orbit');
  assert.equal(orbit.sprites.length, 0);
  assert.deepEqual(orbit.looks.map((l) => l.part).sort(), ['pants', 'shoes', 'top']);
});

test('a demo outfit PNG is used only while all of its pieces are worn and the body matches', () => {
  const preset = { id: 'suit', sprite: sprite(['m']), size: 2 };
  const members = [W('s1', 'top', 'shirt', { preset: 'suit' }), W('s2', 'bottom', 'trousers', { preset: 'suit' })];
  const picks = wear(...members);
  const on = stagePlan(picks, preset, 'm', 'front');
  assert.deepEqual(on.sprites.map((s) => s.slot), ['preset']);
  assert.equal(on.looks.length, 0);
  assert.equal(stagePlan(picks, preset, 'f', 'front').sprites.length, 0, 'other body: proxies');
  const broken = togglePick(picks, members[0]);
  assert.equal(stagePlan(broken, preset, 'm', 'front').sprites.length, 0, 'one piece removed: proxies');
});

test('sprites keep their aspect and land on the body landmarks for each body', () => {
  const view = { width: 390, height: 520 };
  const camera = studioCamera(view.width / view.height);
  const shirt = manifest.items.find((i) => i.id === 'white-shirt');
  const layer = { key: 'top', slot: 'top', type: 'shirt', sprite: { source: 1, width: shirt.width, height: shirt.height, bounds: shirt.bounds, bodyKeys: ['f', 'm'] } };
  const rects = {};
  for (const body of ['f', 'm']) {
    const lm = meta[body].lm;
    const r = spriteRect(layer, lm, view, camera);
    rects[body] = r;
    assert.ok(Math.abs(r.width / r.height - shirt.width / shirt.height) < 1e-9, 'aspect kept');
    // Top-aligned: the visible top of the shirt sits on the projected collar line of the slot box.
    const collar = new THREE.Vector3(0, lm.collar + 0.035, 0).project(camera);
    const top = r.top + (shirt.bounds[1] / shirt.height) * r.height;
    assert.ok(Math.abs(top - ((1 - collar.y) / 2) * view.height) < 1e-6);
    // Centred on the body axis.
    const mid = r.left + ((shirt.bounds[0] + shirt.bounds[2] / 2) / shirt.width) * r.width;
    assert.ok(Math.abs(mid - view.width / 2) < 1e-6);
  }
  assert.ok(rects.m.top < rects.f.top, 'taller male body puts the collar higher');
});

test('front PNGs hide only the body they fully cover; orbit hides nothing', () => {
  // regions: 1 torso, 2 upper arm, 3 forearm, 5 pelvis, 6 thigh, 7 calf, 8 foot
  assert.deepEqual(covers({ slot: 'top', sleeve: 'short', length: null }), [1, 2]);
  assert.deepEqual(covers({ slot: 'bottom', sleeve: null, length: 'short' }), [5]);
  assert.deepEqual(covers({ slot: 'bottom', sleeve: null, length: 'midi' }), [5, 6]);
  assert.deepEqual(covers({ slot: 'bottom', sleeve: null, length: 'long' }), [5, 6, 7]);
  assert.deepEqual(covers({ slot: 'hat', sleeve: null, length: null }), []);
  const sprite = { source: 1, width: 10, height: 10, bounds: [0, 0, 10, 10], bodyKeys: ['m'] };
  const tags = { category: 'top', type: 'shirt', slot: 'top', colors: ['navy'], length: null, sleeve: 'long', fit: 'regular' };
  const picks = { top: { id: 'a', label: 'a', tags, garmentId: null, tryOnAllowed: false, sprite } };
  assert.deepEqual(stagePlan(picks, null, 'm', 'front').hidden, [1, 2, 3]);
  assert.deepEqual(stagePlan(picks, null, 'm', 'orbit').hidden, []);
  assert.deepEqual(stagePlan(picks, null, 'f', 'front').hidden, [], 'a PNG for the other body is a proxy, body stays');
});
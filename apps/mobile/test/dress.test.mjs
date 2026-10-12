import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

import { dress } from '../src/features/studio/dress.ts';
import { lookFor } from '../src/features/studio/looks.ts';

const meta = JSON.parse(readFileSync(new URL('../assets/mannequin/mannequin.json', import.meta.url)));

// Same decoding as scene.ts loadBody, from the real generated meshes.
function body(key, file) {
  const { n, t, lm, skirt } = meta[key];
  const raw = readFileSync(new URL(`../assets/mannequin/${file}.bin`, import.meta.url));
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const q = new Int16Array(buf, 0, n * 3), pos = new Float32Array(n * 3);
  let H = 0;
  for (let j = 0; j < n * 3; j++) { pos[j] = q[j] / 16000; if (j % 3 === 1) H = Math.max(H, pos[j]); }
  const idx = new Uint16Array(buf, n * 6, t * 3), reg = new Uint8Array(buf, n * 6 + t * 6, n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return { n, H, pos, idx, reg, nrm: g.getAttribute('normal').array, lm, skirt };
}

const T = (category, type, slot, extra = {}) => lookFor({ category, type, slot, colors: ['navy'], length: null, sleeve: null, fit: 'regular', ...extra });
const OUTFITS = {
  office: [T('top', 'shirt', 'top', { sleeve: 'long' }), T('outerwear', 'blazer', 'outer'), T('pants', 'wide_leg', 'bottom'), T('shoes', 'loafers', 'shoes'), T('accessory', 'belt', 'belt'), T('accessory', 'watch', 'watch')],
  street: [T('top', 'hoodie', 'top', { sleeve: 'long' }), T('pants', 'jeans', 'bottom'), T('shoes', 'sneakers', 'shoes'), T('bag', 'backpack', 'bag'), T('accessory', 'cap', 'hat'), T('accessory', 'sunglasses', 'eyewear')],
  skirt: [T('top', 't_shirt', 'top', { length: 'cropped' }), T('skirt', 'midi_skirt', 'bottom'), T('shoes', 'sandals', 'shoes'), T('bag', 'crossbody', 'bag'), T('accessory', 'scarf', 'neck'), T('accessory', 'necklace', 'jewelry')],
  aodai: [T('traditional', 'ao_dai', 'dress'), T('shoes', 'heels', 'shoes'), T('bag', 'clutch', 'bag'), T('accessory', 'fedora', 'hat')],
  winter: [T('top', 'sweater', 'top', { sleeve: 'long' }), T('outerwear', 'coat', 'outer'), T('pants', 'trousers', 'bottom'), T('shoes', 'boots', 'shoes'), T('accessory', 'beanie', 'hat'), T('bag', 'tote', 'bag')],
  jumpsuit: [T('one_piece', 'jumpsuit', 'dress', { sleeve: 'sleeveless' })],
  jewelry: [T('top', 'shirt', 'top'), T('accessory', 'tie', 'neck'), T('accessory', 'earrings', 'jewelry'), T('accessory', 'bracelet', 'jewelry'), T('accessory', 'ring', 'jewelry'), T('accessory', 'necklace', 'jewelry')],
  empty: [],
};

test('every outfit dresses both bodies with finite, non-empty meshes', () => {
  for (const [key, file] of [['f', 'female'], ['m', 'male']]) {
    const m = body(key, file);
    const skin = new THREE.MeshStandardMaterial();
    const fig = new THREE.Group();
    for (const [name, looks] of Object.entries(OUTFITS)) {
      dress(fig, m, looks, skin);
      // body + stand, then at least one mesh per look (some looks add several).
      assert.ok(fig.children.length >= 2 + looks.length, `${key}/${name}: ${fig.children.length} meshes`);
      for (const mesh of fig.children) {
        const geo = mesh.geometry;
        assert.ok(geo.index ? geo.index.count > 0 : geo.getAttribute('position').count > 0, `${key}/${name}: empty mesh`);
        assert.ok(geo.getAttribute('position').array.every(Number.isFinite), `${key}/${name}: NaN vertex`);
      }
    }
    assert.equal(fig.children.filter((c) => c.material === skin).length, 1, 'skin material is reused, not disposed');
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('bundled wardrobe matches shared manifest and every PNG has a literal Metro require', () => {
  const shared = JSON.parse(readFileSync(new URL('../../../packages/shared/assets/wardrobe/manifest.json', import.meta.url)));
  const bundled = JSON.parse(readFileSync(new URL('../assets/wardrobe/manifest.json', import.meta.url)));
  assert.deepEqual(bundled, shared);
  const outfitSource = JSON.parse(readFileSync(new URL('../../../packages/shared/assets/wardrobe/casual-outfits.json', import.meta.url)));
  const outfitBundle = JSON.parse(readFileSync(new URL('../assets/wardrobe/casual-outfits.json', import.meta.url)));
  assert.deepEqual(outfitBundle, outfitSource);
  assert.equal(bundled.items.length, 34);
  assert.equal(new Set(bundled.items.map((i) => i.id)).size, 34);
  const source = readFileSync(new URL('../src/features/studio/catalog.ts', import.meta.url), 'utf8');
  for (const item of bundled.items) {
    assert.ok(existsSync(new URL(`../assets/wardrobe/${item.file}`, import.meta.url)), item.file);
    assert.ok(source.includes(`require('@/assets/wardrobe/${item.file}')`), item.file);
    assert.equal(item.demoOnly, true);
  }
});

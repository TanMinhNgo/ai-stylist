import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clampCrop, cropValid, done, keyFor, MAX_ASSET_POLLS, pollDelay, pollGaveUp, typesFor } from '../src/features/assets/logic.ts';

test('a garment photo picks one type from a single-item menu', () => {
  assert.ok(typesFor('jewelry').includes('earrings'));
});

test('polling backs off, is bounded and stops on a final status', () => {
  const delays = [];
  for (let n = 0; pollDelay('processing', n) !== false; n++) delays.push(pollDelay('processing', n));
  assert.equal(delays.length, MAX_ASSET_POLLS);
  assert.ok(delays.every((d, i) => i === 0 || d >= delays[i - 1]) && Math.max(...delays) <= 10_000);
  assert.equal(pollDelay('ready', 0), false);
  assert.equal(pollDelay('failed', 3), false);
  assert.equal(pollGaveUp('processing', MAX_ASSET_POLLS), true);
  assert.equal(pollGaveUp('ready', MAX_ASSET_POLLS), false);
  assert.equal(pollGaveUp('queued', 3), false);
});

test('idempotency key is kept for the same payload and renewed when it changes', () => {
  let n = 0;
  const fresh = () => `key-${++n}`;
  const a = keyFor(null, { items: [1] }, fresh);
  assert.equal(keyFor(a, { items: [1] }, fresh).key, a.key, 'retry reuses the key');
  assert.notEqual(keyFor(a, { items: [2] }, fresh).key, a.key, 'edited payload');
  assert.notEqual(keyFor(null, { items: [1] }, fresh).key, a.key, 'explicit "tạo lại"');
  // Mannequin section: only an ended job frees the key for a new generation.
  assert.deepEqual(['queued', 'processing', 'deferred', undefined, 'ready', 'failed'].map(done), [false, false, false, false, true, true]);
});

test('crop stays inside the image and keeps a minimum size', () => {
  const img = { width: 1000, height: 800 };
  assert.deepEqual(clampCrop({ x: -50, y: 700, width: 300, height: 300 }, img), { x: 0, y: 500, width: 300, height: 300 });
  assert.deepEqual(clampCrop({ x: 10, y: 10, width: 5000, height: 2 }, img), { x: 0, y: 10, width: 1000, height: 64 });
  assert.equal(cropValid({ x: 0, y: 0, width: 1000, height: 800 }, img), true);
  assert.equal(cropValid({ x: 1, y: 0, width: 1000, height: 800 }, img), false);
  assert.equal(cropValid({ x: 0, y: 0, width: 10, height: 800 }, img), false);
});

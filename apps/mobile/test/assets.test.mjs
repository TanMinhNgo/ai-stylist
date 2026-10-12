import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALL_TYPES, clampCrop, cropValid, done, ideaRequest, keyFor, MAX_ASSET_POLLS, pollDelay, pollGaveUp, quotaProblem, typesFor } from '../src/features/assets/logic.ts';

test('idea form: outfit has no type, single-item menus need a type from that menu', () => {
  assert.deepEqual(ideaRequest('outfit', 'shirt', ' bộ đi làm ', 'f'), { menu: 'outfit', prompt: 'bộ đi làm', bodyKey: 'f' });
  assert.equal(ideaRequest('top', null, 'sơ mi', 'm'), null);
  assert.equal(ideaRequest('top', 'jeans', 'sơ mi', 'm'), null, 'type outside the menu');
  assert.equal(ideaRequest('jewelry', 'ring', 'nhẫn bạc', 'm').type, 'ring');
  assert.equal(ideaRequest('top', 'shirt', '   ', 'm'), null, 'empty prompt');
  assert.ok(typesFor('jewelry').includes('earrings'));
  assert.ok(!ALL_TYPES.some((t) => ['underwear', 'swimwear', 'sleepwear'].includes(t)));
});

test('quota: disabled and short batches are refused whole, enough quota passes', () => {
  assert.match(quotaProblem({ enabled: false, remaining: 5 }, 1), /chưa bật/);
  assert.match(quotaProblem({ enabled: true, remaining: 2 }, 3), /Cần 3 lượt.*còn 2/);
  assert.match(quotaProblem({ enabled: true, remaining: 0 }, 1), /hết lượt/);
  assert.equal(quotaProblem({ enabled: true, remaining: 4 }, 4), null);
  assert.ok(quotaProblem(undefined, 1), 'unknown quota never lets a batch through');
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

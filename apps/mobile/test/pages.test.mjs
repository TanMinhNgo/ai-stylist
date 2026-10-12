import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasPending, removeFromPages } from '../src/features/media/pages.ts';

const page = (ids, nextCursor = null) => ({ items: ids.map((id) => ({ id, status: id.startsWith('p') ? 'pending' : 'ready' })), nextCursor });

test('removeFromPages drops the item from every page and keeps cursors', () => {
  const data = { pages: [page(['a', 'b'], 'c1'), page(['c', 'b'])], pageParams: [undefined, 'c1'] };
  const next = removeFromPages(data, 'b');
  assert.deepEqual(next.pages.map((p) => p.items.map((i) => i.id)), [['a'], ['c']]);
  assert.equal(next.pages[0].nextCursor, 'c1');
  assert.deepEqual(data.pages[0].items.length, 2, 'original cache untouched for rollback');
  assert.equal(removeFromPages(undefined, 'x'), undefined);
});

test('hasPending only for pending items', () => {
  assert.equal(hasPending(page(['a', 'p1']).items), true);
  assert.equal(hasPending(page(['a']).items), false);
  assert.equal(hasPending(undefined), false);
  const withJob = (status) => [{ id: 'a', status: 'ready', assetJob: { status } }];
  assert.equal(hasPending(withJob('processing')), true, 'asset still generating');
  assert.equal(hasPending(withJob('queued')), true);
  assert.equal(hasPending(withJob('deferred')), false, 'deferred waits for quota, polling would not change it');
  assert.equal(hasPending(withJob('ready')), false);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CreateCollectionRequest, UpdateCollectionRequest, CollectionListQuery, CollectionResponse } = require('../dist');
test('collections validate names, bounded distinct outfit IDs and reject injected ownership', () => {
  const value = { name: ' Đi làm ', occasion: ' Văn phòng ' };
  assert.deepEqual(CreateCollectionRequest.parse(value), { name: 'Đi làm', occasion: 'Văn phòng', outfitIds: [] });
  const id = randomUUID();
  for (const body of [{ ...value, name: ' ' }, { ...value, outfitIds: [id, id] },
    { ...value, outfitIds: Array.from({ length: 51 }, randomUUID) }, { ...value, userId: id },
    { ...value, plan: 'pro' }]) assert.equal(CreateCollectionRequest.safeParse(body).success, false);
  assert.equal(UpdateCollectionRequest.safeParse({}).success, false);
  assert.ok(UpdateCollectionRequest.safeParse({ outfitIds: [] }).success);
  assert.ok(UpdateCollectionRequest.safeParse({ occasion: 'Tiệc' }).success);
});
test('collection pagination and response exclude private/user data', () => {
  assert.deepEqual(CollectionListQuery.parse({}), { limit: 20 });
  assert.equal(CollectionListQuery.safeParse({ limit: 51 }).success, false);
  assert.equal(CollectionListQuery.safeParse({ cursor: 'bad' }).success, false);
  const value = { id: randomUUID(), name: 'Đi chơi', occasion: 'Cuối tuần', outfitIds: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  assert.ok(CollectionResponse.safeParse(value).success);
  assert.equal(CollectionResponse.safeParse({ ...value, userId: randomUUID() }).success, false);
});

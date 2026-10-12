const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GarmentTags, GarmentListQuery, CreateGarmentRequest, UploadAuthResponse, isTryOnAllowed } = require('../dist');

const tags = { category: 'top', type: 'shirt', slot: 'top', colors: ['trắng'], material: 'cotton', formality: 3,
  pattern: 'solid', fit: 'regular', length: 'regular', sleeve: 'long', neckline: 'cổ bẻ', rise: null, season: ['all'], occasions: ['đi làm'] };

test('category/type/slot and formality are validated together', () => {
  assert.deepEqual(GarmentTags.parse(tags), tags);
  for (const patch of [{ category: 'bag' }, { slot: 'hat' }, { formality: 6 }, { type: 'invented_type' }]) {
    assert.equal(GarmentTags.safeParse({ ...tags, ...patch }).success, false);
  }
});
test('restricted clothing can be tagged but is not eligible for try-on', () => {
  for (const type of ['underwear', 'swimwear', 'sleepwear']) {
    assert.equal(GarmentTags.safeParse({ ...tags, type, category: 'one_piece', slot: 'dress' }).success, true);
    assert.equal(isTryOnAllowed(type), false);
  }
  assert.equal(isTryOnAllowed('shirt'), true);
});
test('pagination limits and cursors are constrained', () => {
  assert.equal(GarmentListQuery.parse({}).limit, 20);
  assert.equal(GarmentListQuery.parse({ limit: '50', category: 'top' }).limit, 50);
  for (const input of [{ limit: 0 }, { limit: 51 }, { cursor: 'other-user-string' }, { category: 'invalid' }]) {
    assert.equal(GarmentListQuery.safeParse(input).success, false);
  }
});
test('registration needs an upload grant and cannot take userId from clients', () => {
  const input = { imagekitFileId: 'file', url: 'https://images.example.com/test.jpg', uploadToken: 'c582a2a0-9786-47b4-91a7-733d0f860e47' };
  assert.deepEqual(CreateGarmentRequest.parse(input), { ...input, generateAsset: false, bodyKey: 'f' });
  assert.equal(CreateGarmentRequest.safeParse({ ...input, userId: 'attacker' }).success, false);
  assert.equal(CreateGarmentRequest.safeParse({ imagekitFileId: 'file', url: input.url }).success, false);
  assert.equal(UploadAuthResponse.safeParse({ token: input.uploadToken, expire: 1, signature: 's', publicKey: 'pk', urlEndpoint: 'https://images.example.com', folder: '/stylist/fixture', isPrivateFile: false }).success, false);
});

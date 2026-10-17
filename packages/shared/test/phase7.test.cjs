const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const s = require('../dist');
test('billing sync cannot accept client receipts, identities or plan overrides', () => {
  assert.deepEqual(s.EmptyRequest.parse({}), {});
  for (const field of ['plan', 'receipt', 'appUserId', 'userId']) assert.equal(s.EmptyRequest.safeParse({ [field]: 'pro' }).success, false);
});
test('calendar/context require real dates, complete coordinates, time zones and owner-safe fields', () => {
  const query = { startDate: '2026-10-17', timeZone: 'Asia/Ho_Chi_Minh' };
  assert.equal(s.PlannerContextQuery.safeParse(query).success, true);
  assert.equal(s.PlannerContextQuery.parse({ ...query, latitude: '10.8', longitude: '106.7' }).latitude, 10.8);
  for (const extra of [{ latitude: 10 }, { latitude: '', longitude: '' }, { latitude: 91, longitude: 0 }, { startDate: '2026-02-30' }, { userId: randomUUID() }])
    assert.equal(s.PlannerContextQuery.safeParse({ ...query, ...extra }).success, false);
  const body = { date: query.startDate, timeZone: 'UTC', title: 'Đi làm', occasion: 'work' };
  assert.equal(s.PutCalendarEventRequest.safeParse(body).success, true);
  assert.equal(s.PutCalendarEventRequest.safeParse({ ...body, userId: randomUUID() }).success, false);
});
test('curated affiliate catalog rejects executable links, embedded credentials and duplicate product IDs', () => {
  const product = { id: 'bag-1', name: 'Bag', type: 'handbag', merchant: 'Shop', url: 'https://shop.example/p?ref=stylist' };
  // Use an actual type from the public vocabulary rather than creating an affiliate-only taxonomy.
  product.type = s.GarmentType.options.includes('handbag') ? 'handbag' : s.GarmentType.options[0];
  assert.equal(s.AffiliateCatalog.safeParse([product]).success, true);
  for (const url of ['javascript:alert(1)', 'http://shop.example', 'https://user:pass@shop.example'])
    assert.equal(s.AffiliateCatalog.safeParse([{ ...product, url }]).success, false);
  assert.equal(s.AffiliateCatalog.safeParse([product, product]).success, false);
  assert.equal(s.PutAffiliateClickRequest.safeParse({ productId: product.id, url: 'https://evil.example' }).success, false);
});
test('share selection is explicit, bounded, unique and expires within seven days', () => {
  const outfitIds = [randomUUID()];
  assert.equal(s.CreateLookbookShareRequest.parse({ outfitIds }).expiresInHours, 24);
  for (const value of [{ outfitIds: [] }, { outfitIds: [...outfitIds, ...outfitIds] }, { outfitIds, expiresInHours: 169 }, { outfitIds, userId: randomUUID() }])
    assert.equal(s.CreateLookbookShareRequest.safeParse(value).success, false);
  assert.equal(s.ShareTokenParams.safeParse({ token: '../private' }).success, false);
});

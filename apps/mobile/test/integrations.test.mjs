import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coarse, deviceEventBody, manageUrl, shopQuery, weatherLine } from '../src/features/integrations/logic.ts';
import { messageFor, RequestError } from '../src/lib/errors.ts';

test('a picked phone event sends only its title and its local day', () => {
  // 23:30 UTC on the 16th is already the 17th in Saigon.
  const body = deviceEventBody({ title: '  Họp khách hàng  ', startDate: '2026-10-16T23:30:00Z', notes: 'secret', location: 'office' }, 'Asia/Saigon');
  assert.deepEqual(body, { date: '2026-10-17', timeZone: 'Asia/Saigon', title: 'Họp khách hàng', occasion: 'Họp khách hàng' });
  assert.equal(deviceEventBody({ title: '', startDate: new Date('2026-10-17T05:00:00Z') }, 'UTC').title, 'Sự kiện');
  assert.equal(deviceEventBody({ title: 'x'.repeat(300), startDate: '2026-10-17T05:00:00Z' }, 'UTC').title.length, 120);
});

test('coordinates are rounded before they leave the phone', () => {
  assert.deepEqual(coarse({ latitude: 10.776889, longitude: 106.700806 }), { latitude: 10.78, longitude: 106.7 });
});

test('weather line and store management link per platform', () => {
  assert.equal(weatherLine({ date: '2026-10-17', minC: 24.4, maxC: 31.6, rainProbability: 70, code: 61 }), '24–32°C · mưa 70%');
  const urls = { ios: 'https://apps.apple.com/account/subscriptions', android: 'https://play.google.com/store/account/subscriptions' };
  assert.equal(manageUrl(urls, 'ios'), urls.ios);
  assert.equal(manageUrl(urls, 'android'), urls.android);
  assert.equal(manageUrl(null, 'ios'), null);
});

test('an advice accessory becomes shop filters; type only when it is a known garment type', () => {
  assert.deepEqual(shopQuery('Sunglasses'), { q: 'Sunglasses', type: 'sunglasses' });
  assert.deepEqual(shopQuery('  túi da nhỏ '), { q: 'túi da nhỏ' });
  assert.equal(shopQuery('a'.repeat(200)).q.length, 80);
});

test('Phase 7 caps have their own messages, not the try-on one', () => {
  for (const [resource, words] of [['calendar_events', /730 sự kiện/], ['affiliate_clicks', /liên kết mua sắm/], ['lookbook_shares', /20 link/]])
    assert.match(messageFor(new RequestError('QUOTA_EXCEEDED', 429, { resource })), words);
});

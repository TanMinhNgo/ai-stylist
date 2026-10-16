import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EntitlementsResponse, PLAN_FEATURES, UsageResponse } from '@stylist/shared';
import { deletionConfirmed, deleteThenSignOut, offline, planBenefits, resetDelay, resetLabel, usageBlocked } from '../src/features/usage/logic.ts';
import { RequestError, messageFor, stylistJobMessage, toRequestError } from '../src/lib/errors.ts';

const usage = (remaining) => UsageResponse.parse({ plan: 'free', limit: 5, used: 5 - remaining, remaining, resetsAt: '2026-11-01T00:00:00.000Z' });
test('quota waits for backend truth, disables zero and unlocks after refreshed monthly reset', () => {
  assert.equal(usageBlocked(undefined), true); assert.equal(usageBlocked(usage(0)), true); assert.equal(usageBlocked(usage(5)), false);
  assert.ok(resetLabel(usage(0).resetsAt).includes('2026')); assert.equal(usage(0).resetsAt, '2026-11-01T00:00:00.000Z');
  assert.equal(resetDelay(usage(0), Date.parse('2026-10-31T23:58:00Z')), 121000);
  assert.equal(resetDelay(usage(0), Date.parse('2026-11-02T00:00:00Z')), 60000);
  assert.equal(resetDelay(undefined), false);
});
test('429 keeps details and never auto retries; rate delay displays when valid', () => {
  const rate = toRequestError({ response: { status: 429, data: { code: 'RATE_LIMITED', message: 'x', details: { retryAfterSeconds: 7 } } } });
  assert.equal(rate.retryable, false); assert.match(messageFor(rate), /7 giây/);
  assert.equal(new RequestError('QUOTA_EXCEEDED', 429).retryable, false);
  assert.equal(toRequestError({ response: { status: 429, data: { code: 'QUOTA_EXCEEDED', message: 'x', details: { resetsAt: usage(0).resetsAt } } } }).details.resetsAt, usage(0).resetsAt);
  assert.ok(messageFor(new RequestError('RATE_LIMITED', 429, { retryAfterSeconds: 'bad' })).length > 10);
});
test('deletion needs both confirmation steps and exact text', () => {
  assert.equal(deletionConfirmed(1, 'XÓA'), false); assert.equal(deletionConfirmed(2, 'XÓA'), true);
  assert.equal(deletionConfirmed(2, 'xóa'), true); assert.equal(deletionConfirmed(2, 'XÓA'), true);
  assert.equal(deletionConfirmed(2, 'XOA'), false); assert.equal(deletionConfirmed(2, ''), false);
});
test('delete signs out only after a parsed receipt; retries reuse backend receipt', async () => {
  const receipt = { deletionId: '00000000-0000-4000-8000-000000000001', status: 'queued' };
  const order = []; const remove = async () => { order.push('delete'); return receipt; };
  const accept = (r) => { assert.deepEqual(r, receipt); order.push('receipt'); };
  const signOut = async () => order.push('signout');
  assert.deepEqual(await deleteThenSignOut(remove, accept, signOut), receipt); assert.deepEqual(order, ['delete', 'receipt', 'signout']);
  assert.deepEqual(await deleteThenSignOut(remove, accept, signOut), receipt);
  let signed = false;
  await assert.rejects(deleteThenSignOut(async () => { throw new Error('offline'); }, accept, async () => { signed = true; }));
  await assert.rejects(deleteThenSignOut(async () => ({}), accept, async () => { signed = true; })); assert.equal(signed, false);
});
test('only a missing network connection counts as offline', () => {
  assert.equal(offline({}), false); assert.equal(offline({ isConnected: false }), true);
  assert.equal(offline({ isConnected: true, isInternetReachable: false }), false);
});

test('plan benefits only list availableFeatures; included-but-unavailable stays upcoming', () => {
  const e = EntitlementsResponse.parse({ plan: 'plus', includedFeatures: PLAN_FEATURES.plus, availableFeatures: ['digital_wardrobe', 'ai_styling', 'personal_lookbook', 'monthly_try_on_20'], tryOn: { limit: 20, period: 'calendar_month_utc', resetsAt: '2026-11-01T00:00:00.000Z' } });
  const b = planBenefits(e);
  assert.deepEqual(b.available, ['Tủ đồ số', 'Tư vấn phối đồ AI', 'Lookbook cá nhân']);
  assert.deepEqual(b.upcoming, ['Phân tích bộ phối chi tiết', 'Gợi ý phụ kiện', 'Bộ sưu tập theo dịp']);
});

test('stylist quota (429 resource=stylist or failed job) has its own message, try-on quota keeps the old one', () => {
  const stylist = toRequestError({ response: { status: 429, data: { code: 'QUOTA_EXCEEDED', message: 'x', details: { resource: 'stylist' } } } });
  assert.match(messageFor(stylist), /tư vấn stylist/);
  assert.match(messageFor(new RequestError('QUOTA_EXCEEDED', 429, { resetsAt: '2026-11-01T00:00:00.000Z' })), /thử đồ/);
  assert.equal(stylistJobMessage('QUOTA_EXCEEDED'), messageFor(stylist));
  assert.equal(stylistJobMessage('STYLIST_PROVIDER_ERROR'), null); assert.equal(stylistJobMessage(null), null);
});

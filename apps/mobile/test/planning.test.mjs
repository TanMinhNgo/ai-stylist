import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EntitlementsResponse, PLAN_FEATURES, PlannerWeekQuery, PutWearRecordRequest } from '@stylist/shared';
import { addDays, featureOn, localDate, plannerWritable, toggleOutfit } from '../src/features/planning/logic.ts';
import { RequestError, messageFor } from '../src/lib/errors.ts';

test('local date follows the given time zone, not UTC, and passes the shared schemas', () => {
  const now = new Date('2026-10-17T20:30:00Z');
  assert.equal(localDate('UTC', now), '2026-10-17');
  assert.equal(localDate('Asia/Ho_Chi_Minh', now), '2026-10-18');
  assert.equal(localDate('America/Los_Angeles', now), '2026-10-17');
  const startDate = localDate('Asia/Ho_Chi_Minh', now);
  assert.ok(PlannerWeekQuery.safeParse({ startDate, timeZone: 'Asia/Ho_Chi_Minh' }).success);
  assert.ok(PutWearRecordRequest.safeParse({ date: startDate, timeZone: 'Asia/Ho_Chi_Minh', outfitId: '00000000-0000-4000-8000-000000000001' }).success);
});

test('calendar arithmetic crosses months, years and DST without drifting', () => {
  assert.equal(addDays('2026-10-29', 7), '2026-11-05');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-03-07', 2), '2026-03-09');
  assert.equal(addDays('2026-10-17', -29), '2026-09-18');
});

test('planner writes only today..+365, past days stay read-only', () => {
  assert.equal(plannerWritable('2026-10-16', '2026-10-17'), false);
  assert.equal(plannerWritable('2026-10-17', '2026-10-17'), true);
  assert.equal(plannerWritable(addDays('2026-10-17', 365), '2026-10-17'), true);
  assert.equal(plannerWritable(addDays('2026-10-17', 366), '2026-10-17'), false);
});

test('only availableFeatures unlock editing', () => {
  const ent = (plan, available) => EntitlementsResponse.parse({ plan, includedFeatures: PLAN_FEATURES[plan], availableFeatures: available, tryOn: { limit: 60, period: 'calendar_month_utc', resetsAt: '2026-11-01T00:00:00.000Z' } });
  assert.equal(featureOn(undefined, 'weekly_outfit_planner'), false);
  assert.equal(featureOn(ent('pro', []), 'weekly_outfit_planner'), false);
  assert.equal(featureOn(ent('pro', ['weekly_outfit_planner']), 'weekly_outfit_planner'), true);
});

test('collection outfit list toggles and respects the 50 cap', () => {
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  assert.deepEqual(toggleOutfit([id(1)], id(2)), [id(1), id(2)]);
  assert.deepEqual(toggleOutfit([id(1), id(2)], id(1)), [id(2)]);
  const full = Array.from({ length: 50 }, (_, i) => id(i));
  assert.equal(toggleOutfit(full, id(99)), null);
  assert.equal(toggleOutfit(full, id(3)).length, 49);
});

test('429 names the right resource and never reads as running out of AI turns', () => {
  const quota = (resource) => messageFor(new RequestError('QUOTA_EXCEEDED', 429, { resource, limit: 1 }));
  assert.match(quota('collections'), /50 bộ sưu tập/);
  assert.match(quota('planner'), /730 ngày/);
  assert.match(quota('wear_history'), /5 lần/);
  for (const r of ['collections', 'planner', 'wear_history']) assert.doesNotMatch(quota(r), /thử đồ|tư vấn/);
  assert.match(quota('unknown'), /thử đồ/);
  assert.match(messageFor(new RequestError('FORBIDDEN', 403, { feature: 'weekly_outfit_planner', reason: 'not_included' })), /gói hiện tại/);
});

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { StylistUsageResponse, BasicStylistAdvice, StylistAdvice, PLAN_STYLIST_LIMITS } = require('../dist');
test('stylist caps and level agree with the verified plan, including exhausted downgraded usage', () => {
  assert.deepEqual(PLAN_STYLIST_LIMITS, { free: 10, plus: 60, pro: 180 });
  const value = { plan: 'free', adviceLevel: 'basic', limit: 10, used: 12, remaining: 0,
    period: 'calendar_month_utc', resetsAt: '2026-11-01T00:00:00Z' };
  assert.ok(StylistUsageResponse.safeParse(value).success);
  for (const change of [{ adviceLevel: 'advanced' }, { remaining: 1 }, { limit: 180 }, { used: -1 }, { userId: 'x' }])
    assert.equal(StylistUsageResponse.safeParse({ ...value, ...change }).success, false);
});
test('basic advice keeps the legacy fields while excluding advanced adjustments and accessories', () => {
  const advice = { summary: 'Tổng quan', strengths: ['Màu hài hòa'], adjustments: [], accessories: [],
    occasionFit: { score: 3, reason: 'Phù hợp dịp' } };
  assert.ok(BasicStylistAdvice.safeParse(advice).success);
  assert.ok(StylistAdvice.safeParse(advice).success);
  const detailed = { ...advice, adjustments: [{ suggestion: 'Thử màu sáng', reason: 'Tạo điểm nhấn' }] };
  assert.ok(StylistAdvice.safeParse(detailed).success);
  assert.equal(BasicStylistAdvice.safeParse(detailed).success, false);
});

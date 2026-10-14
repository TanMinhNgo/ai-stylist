const assert = require('node:assert/strict');
const { test } = require('node:test');
const { UsageResponse, AccountDeletionResponse, ApiError } = require('../dist');
test('usage is server-owned counts and UTC reset, not billing price', () => {
  const value = { plan: 'free', limit: 5, used: 1, remaining: 4, resetsAt: '2026-11-01T00:00:00Z' };
  assert.ok(UsageResponse.safeParse(value).success);
  assert.equal(UsageResponse.safeParse({ ...value, price: 10 }).success, false);
  assert.equal(UsageResponse.safeParse({ ...value, remaining: -1 }).success, false);
});
test('deletion receipt is asynchronous and throttling errors keep retry data', () => {
  assert.ok(AccountDeletionResponse.safeParse({ deletionId: '550e8400-e29b-41d4-a716-446655440000', status: 'queued' }).success);
  assert.ok(ApiError.safeParse({ code: 'RATE_LIMITED', message: 'Wait', details: { retryAfterSeconds: 30 } }).success);
});

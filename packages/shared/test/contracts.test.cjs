const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HealthResponse, ApiError, ErrorCode } = require('../dist');
const { MeResponse, ClerkUserWebhook, WebhookAckResponse } = require('../dist');

test('health accepts only the agreed response', () => {
  assert.deepEqual(HealthResponse.parse({ status: 'ok' }), { status: 'ok' });
  for (const input of [{}, { status: 'down' }, { status: 'ok', secret: 'x' }]) {
    assert.equal(HealthResponse.safeParse(input).success, false);
  }
});

test('errors enforce known codes and a non-empty message', () => {
  for (const code of ErrorCode.options) {
    assert.equal(ApiError.safeParse({ code, message: 'Request failed' }).success, true);
  }
  assert.equal(ApiError.safeParse({ code: 'UNKNOWN', message: 'x' }).success, false);
  assert.equal(ApiError.safeParse({ code: 'NOT_FOUND', message: '' }).success, false);
});

test('me validates UUID, email/null, timestamps and excludes private fields', () => {
  const user = { id: '6aac5ae9-f260-44ec-9554-c7c608120028', email: null, createdAt: '2026-10-10T00:00:00Z' };
  assert.deepEqual(MeResponse.parse(user), user);
  for (const patch of [{ id: 'clerk_id' }, { email: 'not-an-email' }, { createdAt: 'yesterday' }, { clerkUserId: 'user_private' }]) {
    assert.equal(MeResponse.safeParse({ ...user, ...patch }).success, false);
  }
  assert.deepEqual(WebhookAckResponse.parse({ received: true }), { received: true });
});

test('signed deleted events still need a timestamp and an actual deleted flag', () => {
  assert.equal(ClerkUserWebhook.safeParse({ type: 'user.deleted', timestamp: 100, data: { id: 'user_1', deleted: true } }).success, true);
  assert.equal(ClerkUserWebhook.safeParse({ type: 'user.deleted', data: { id: 'user_1' } }).success, false);
});

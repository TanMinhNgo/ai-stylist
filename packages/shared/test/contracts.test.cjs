const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HealthResponse, ApiError, ErrorCode } = require('../dist');

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

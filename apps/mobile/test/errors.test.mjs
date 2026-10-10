import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RequestError, messageFor, toRequestError } from '../src/lib/errors.ts';

test('API error bodies keep their shared code', () => {
  const error = toRequestError({ response: { status: 404, data: { code: 'NOT_FOUND', message: 'x' } } });
  assert.equal(error.code, 'NOT_FOUND');
  assert.equal(error.retryable, false);
});

test('failures without a valid body get client codes', () => {
  assert.equal(toRequestError(new Error('socket hang up')).code, 'NETWORK_ERROR');
  assert.equal(toRequestError({ response: { status: 502, data: '<html>' } }).code, 'INTERNAL_ERROR');
  assert.equal(toRequestError({ response: { status: 400, data: { code: 'NOPE' } } }).code, 'BAD_RESPONSE');
});

test('only network and 5xx failures are retryable', () => {
  assert.equal(new RequestError('NETWORK_ERROR').retryable, true);
  assert.equal(new RequestError('INTERNAL_ERROR', 503).retryable, true);
  assert.equal(new RequestError('UNAUTHORIZED', 401).retryable, false);
});

test('every code has a Vietnamese message', () => {
  for (const code of ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'INTERNAL_ERROR', 'NETWORK_ERROR', 'BAD_RESPONSE']) {
    assert.ok(messageFor(new RequestError(code)).length > 10, code);
  }
});

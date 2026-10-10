import { test } from 'node:test';
import assert from 'node:assert/strict';

import { authMessage, clerkCode } from '../src/features/auth/errors.ts';

test('reads the code from API and client Clerk errors', () => {
  assert.equal(clerkCode({ errors: [{ code: 'form_code_incorrect' }] }), 'form_code_incorrect');
  assert.equal(clerkCode({ code: 'network_error' }), 'network_error');
  assert.equal(clerkCode(null), undefined);
});

test('known codes get specific Vietnamese messages, unknown ones a generic one', () => {
  assert.equal(authMessage({ errors: [{ code: 'form_code_incorrect' }] }), 'Mã xác minh không đúng.');
  assert.equal(authMessage({ errors: [{ code: 'something_new' }] }), 'Không đăng nhập được, vui lòng thử lại.');
});

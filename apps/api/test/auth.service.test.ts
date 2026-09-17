import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordHash } from '../src/auth/auth.service';

test('password hashes are salted and not reversible plaintext', () => {
  const first = createPasswordHash('Correct Horse Battery Staple');
  const second = createPasswordHash('Correct Horse Battery Staple');

  assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.equal(first.includes('Correct Horse Battery Staple'), false);
});

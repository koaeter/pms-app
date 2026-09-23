import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthService, createPasswordHash } from '../src/auth/auth.service';

test('password hashes are salted and not reversible plaintext', () => {
  const first = createPasswordHash('Correct Horse Battery Staple');
  const second = createPasswordHash('Correct Horse Battery Staple');

  assert.notEqual(first, second);
  assert.match(first, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.equal(first.includes('Correct Horse Battery Staple'), false);
});

test('password change verifies current password, updates hash, and revokes sessions', async () => {
  const currentHash = createPasswordHash('CurrentPassword123');
  let updatedHash = '';
  let revoked = false;
  const service = new AuthService({
    user: {
      findUnique: async () => ({ id: 'user-a', passwordHash: currentHash, isActive: true }),
      update: async ({ data }: any) => { updatedHash = data.passwordHash; return { id: 'user-a' }; },
    },
    session: {
      deleteMany: async ({ where }: any) => { revoked = where.userId === 'user-a'; return { count: 2 }; },
    },
  } as any);

  const result = await service.changePassword('user-a', 'CurrentPassword123', 'NewPassword123');
  assert.deepEqual(result, { success: true });
  assert.notEqual(updatedHash, currentHash);
  assert.equal(revoked, true);
});

test('password change rejects an incorrect current password', async () => {
  const service = new AuthService({
    user: { findUnique: async () => ({ id: 'user-a', passwordHash: createPasswordHash('CorrectPassword123'), isActive: true }) },
  } as any);

  await assert.rejects(
    () => service.changePassword('user-a', 'WrongPassword123', 'NewPassword123'),
    (error: any) => error?.response?.message === 'Current password is incorrect',
  );
});

test('password change rejects weak replacement passwords', async () => {
  const service = new AuthService({} as any);

  await assert.rejects(
    () => service.changePassword('user-a', 'CurrentPassword123', 'short'),
    (error: any) => error?.response?.message === 'New password must be at least 10 characters',
  );
});

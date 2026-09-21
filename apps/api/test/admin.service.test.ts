import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { AdminService } from '../src/admin/admin.service';

function service() {
  return new AdminService({
    user: {
      findMany: async () => [],
      findUnique: async ({ where, include }: any) => ({
        id: where.id,
        employee: { organisationId: where.id === 'user-b' ? 'org-b' : 'org-a' },
      }),
      update: async ({ where, data }: any) => ({ id: where.id, username: 'user', isActive: data.isActive }),
    },
    role: { findUnique: async () => ({ id: 'role-1', name: 'EMPLOYEE' }) },
    userRole: { upsert: async (args: any) => args },
  } as any);
}

test('scoped administrators can only list users in their organisation', async () => {
  const prisma = {
    user: {
      findMany: async ({ where }: any) => where,
    },
  };
  const admin = new AdminService(prisma as any);
  const where = await admin.listUsers({
    permissions: ['users.read'],
    roles: ['HR_ADMIN'],
    organisationId: 'org-a',
  });
  assert.deepEqual(where, { employee: { organisationId: 'org-a' } });
});

test('scoped administrators cannot change a user outside their organisation', async () => {
  await assert.rejects(
    () => service().setUserStatus({
      id: 'admin-a',
      permissions: ['users.manage'],
      roles: ['HR_ADMIN'],
      organisationId: 'org-a',
    }, 'user-b', false),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('scoped administrators cannot assign roles to users outside their organisation', async () => {
  await assert.rejects(
    () => service().assignRole({
      id: 'admin-a',
      permissions: ['roles.manage'],
      roles: ['HR_ADMIN'],
      organisationId: 'org-a',
    }, 'user-b', 'role-1'),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

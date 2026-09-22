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
    userRole: { upsert: async ({ create }: any) => create },
  } as any, { record: async () => undefined } as any);
}

test('scoped administrators can only list users in their organisation', async () => {
  const prisma = {
    user: {
      findMany: async ({ where }: any) => where,
    },
  };
  const admin = new AdminService(prisma as any, { record: async () => undefined } as any);
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

test('scoped administrators cannot assign elevated administrative roles', async () => {
  const admin = new AdminService({
    user: {
      findUnique: async () => ({ id: 'user-a', employee: { organisationId: 'org-a' } }),
    },
    role: { findUnique: async () => ({ id: 'role-admin', name: 'SYSTEM_ADMIN' }) },
    userRole: { upsert: async () => ({}) },
  } as any, { record: async () => undefined } as any);

  await assert.rejects(
    () => admin.assignRole({
      id: 'admin-a',
      permissions: ['roles.manage'],
      roles: ['HR_ADMIN'],
      organisationId: 'org-a',
    }, 'user-a', 'role-admin'),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('system administrators can assign elevated administrative roles', async () => {
  const admin = new AdminService({
    user: {
      findUnique: async () => ({ id: 'user-a', employee: { organisationId: 'org-a' } }),
    },
    role: { findUnique: async () => ({ id: 'role-admin', name: 'SYSTEM_ADMIN' }) },
    userRole: { upsert: async (args: any) => args },
  } as any, { record: async () => undefined } as any);

  const result = await admin.assignRole({
    id: 'root',
    permissions: ['roles.manage'],
    roles: ['SYSTEM_ADMIN'],
    organisationId: null,
  }, 'user-a', 'role-admin');

  assert.equal(result.userId, 'user-a');
  assert.equal(result.roleId, 'role-admin');
});


test('scoped administrators can only read audit logs from their organisation', async () => {
  const prisma = { user: { findMany: async () => [{ id: 'actor-a' }] }, auditLog: { findMany: async ({ where }: any) => where } };
  const admin = new AdminService(prisma as any, { record: async () => undefined } as any);
  const where = await admin.listAudit({ permissions: ['audit.read'], roles: ['HR_ADMIN'], organisationId: 'org-a' });
  assert.deepEqual(where, { actorId: { in: ['actor-a'] } });
});

test('system administrators can read audit logs across organisations', async () => {
  const prisma = { auditLog: { findMany: async ({ where }: any) => where } };
  const admin = new AdminService(prisma as any, { record: async () => undefined } as any);
  const where = await admin.listAudit({ permissions: ['audit.read'], roles: ['SYSTEM_ADMIN'], organisationId: null });
  assert.equal(where, undefined);
});

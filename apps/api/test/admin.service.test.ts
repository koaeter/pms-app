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
    userRole: {
      count: async () => 0,
      create: async ({ data }: any) => data,
      findUniqueOrThrow: async ({ where }: any) => where.userId_roleId,
    },
    session: { deleteMany: async () => ({ count: 0 }) },
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

test('the last active system administrator cannot be deactivated', async () => {
  const admin = new AdminService({
    user: {
      findUnique: async () => ({ id: 'root', isActive: true, employee: { organisationId: 'org-a' } }),
      update: async () => ({ id: 'root', username: 'root', isActive: false }),
    },
    role: { findUnique: async () => ({ id: 'role-system', name: 'SYSTEM_ADMIN' }) },
    userRole: {
      count: async ({ where }: any) => where.userId === 'root' ? 1 : 1,
    },
    session: { deleteMany: async () => ({ count: 1 }) },
    $transaction: async (fn: any) => fn({
      user: { findUnique: async () => ({ id: 'root', isActive: true }), update: async () => ({ id: 'root', username: 'root', isActive: false }) },
      role: { findUnique: async () => ({ id: 'role-system', name: 'SYSTEM_ADMIN' }) },
      userRole: { count: async ({ where }: any) => where.userId === 'root' ? 1 : 1 },
    }),
  } as any, { record: async () => undefined } as any);

  await assert.rejects(
    () => admin.setUserStatus({
      id: 'admin-a',
      permissions: ['users.manage'],
      roles: ['SYSTEM_ADMIN'],
      organisationId: null,
    }, 'root', false),
    (error: any) => error?.response?.message === 'At least one active system administrator account must remain',
  );
});

test('the last system administrator role cannot be removed', async () => {
  const admin = new AdminService({
    user: { findUnique: async () => ({ id: 'root', employee: { organisationId: 'org-a' } }) },
    role: { findUnique: async () => ({ id: 'role-system', name: 'SYSTEM_ADMIN' }) },
    userRole: {
      count: async () => 1,
      deleteMany: async () => ({ count: 1 }),
    },
    session: { deleteMany: async () => ({ count: 1 }) },
    $transaction: async (fn: any) => fn({
      userRole: { count: async () => 1, deleteMany: async () => ({ count: 1 }) },
    }),
  } as any, { record: async () => undefined } as any);

  await assert.rejects(
    () => admin.removeRole({
      id: 'root-2',
      permissions: ['roles.manage'],
      roles: ['SYSTEM_ADMIN'],
      organisationId: null,
    }, 'root', 'role-system'),
    (error: any) => error?.response?.message === 'At least one system administrator role assignment must remain',
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
    session: { deleteMany: async () => ({ count: 0 }) },
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
    userRole: { create: async ({ data }: any) => data },
    session: { deleteMany: async () => ({ count: 0 }) },
  } as any, { record: async (args: any) => args } as any);

  const result = await admin.assignRole({
    id: 'root',
    permissions: ['roles.manage'],
    roles: ['SYSTEM_ADMIN'],
    organisationId: null,
  }, 'user-a', 'role-admin');

  assert.equal(result.userId, 'user-a');
  assert.equal(result.roleId, 'role-admin');
});

test('reassigning an existing role is idempotent and does not emit another audit event', async () => {
  let auditCount = 0;
  const admin = new AdminService({
    user: { findUnique: async () => ({ id: 'user-a', employee: { organisationId: 'org-a' } }) },
    role: { findUnique: async () => ({ id: 'role-employee', name: 'EMPLOYEE' }) },
    userRole: {
      create: async () => {
        const error = new Error('Unique constraint failed') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      },
      findUniqueOrThrow: async ({ where }: any) => where.userId_roleId,
    },
    session: { deleteMany: async () => ({ count: 1 }) },
  } as any, { record: async () => { auditCount += 1; } } as any);

  const result = await admin.assignRole({
    id: 'admin-a',
    permissions: ['roles.manage'],
    roles: ['HR_ADMIN'],
    organisationId: 'org-a',
  }, 'user-a', 'role-employee');

  assert.deepEqual(result, { userId: 'user-a', roleId: 'role-employee' });
  assert.equal(auditCount, 0);
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


test('scoped administrators can revoke an assigned non-elevated role in their organisation', async () => {
  const admin = new AdminService({
    user: { findUnique: async () => ({ id: 'user-a', employee: { organisationId: 'org-a' } }) },
    role: { findUnique: async () => ({ id: 'role-employee', name: 'EMPLOYEE' }) },
    userRole: { deleteMany: async () => ({ count: 1 }) },
    session: { deleteMany: async () => ({ count: 0 }) },
  } as any, { record: async (action: string) => ({ action }) } as any);

  const result = await admin.removeRole({
    id: 'admin-a',
    permissions: ['roles.manage'],
    roles: ['HR_ADMIN'],
    organisationId: 'org-a',
  }, 'user-a', 'role-employee');

  assert.deepEqual(result, { userId: 'user-a', roleId: 'role-employee', removed: true });
});

test('administrators cannot remove the system administrator role', async () => {
  const admin = new AdminService({
    user: { findUnique: async () => ({ id: 'root', employee: { organisationId: 'org-a' } }) },
    role: { findUnique: async () => ({ id: 'role-system', name: 'SYSTEM_ADMIN' }) },
    userRole: { deleteMany: async () => ({ count: 1 }) },
  } as any, { record: async () => undefined } as any);

  await assert.rejects(
    () => admin.removeRole({
      id: 'admin-a',
      permissions: ['roles.manage'],
      roles: ['HR_ADMIN'],
      organisationId: 'org-a',
    }, 'root', 'role-system'),
    (error: unknown) => error instanceof ForbiddenException,
  );
});


test('user creation rejects duplicate username or email cleanly', async () => {
  const admin = new AdminService({
    user: {
      create: async () => {
        const error = new Error('Unique constraint failed') as Error & { code: string };
        error.code = 'P2002';
        throw error;
      },
    },
  } as any, { record: async () => undefined } as any);

  await assert.rejects(
    () => admin.createUser(
      { id: 'admin-a', permissions: ['users.manage'] },
      { username: 'existing', password: 'valid-password', firstName: 'Test', lastName: 'User' },
    ),
    (error: any) => error?.response?.message === 'Username or email is already in use',
  );
});

test('user creation rejects blank identity fields and malformed email', async () => {
  const admin = new AdminService({ user: { create: async () => ({}) } } as any, { record: async () => undefined } as any);
  const actor = { id: 'admin-a', permissions: ['users.manage'] };

  await assert.rejects(
    () => admin.createUser(actor, { username: '  ', password: 'valid-password', firstName: 'Test', lastName: 'User' }),
    (error: any) => error?.response?.message === 'Username is required',
  );

  await assert.rejects(
    () => admin.createUser(actor, { username: 'user', password: 'valid-password', firstName: 'Test', lastName: 'User', email: 'invalid' }),
    (error: any) => error?.response?.message === 'Email address is invalid',
  );
});

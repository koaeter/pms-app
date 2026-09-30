import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { OrganisationService } from '../src/organisation/organisation.service';

function basePrisma(existingOrganisationId: string | null) {
  return {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    user: { findUnique: async () => ({ id: 'user-a' }) },
    department: { findFirst: async () => null },
    designation: { findFirst: async () => null },
    employee: {
      findUnique: async ({ where }: any) => existingOrganisationId
        ? { id: where.userId ? 'employee-a' : where.id, organisationId: existingOrganisationId, managerId: null }
        : null,
      upsert: async ({ update }: any) => ({ id: 'employee-a', organisationId: update.organisationId }),
    },
    performancePlan: { count: async () => 0 },
  };
}

test('scoped administrator cannot move an existing employee from another organisation', async () => {
  const service = new OrganisationService(basePrisma('org-b') as any, { record: async () => undefined } as any);

  await assert.rejects(
    () => service.assignEmployee(
      { userId: 'user-a', employeeNumber: 'E001', organisationId: 'org-a' },
      { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
    ),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('system administrator can move an existing employee between organisations', async () => {
  const service = new OrganisationService(basePrisma('org-b') as any);

  const result = await service.assignEmployee(
    { userId: 'user-a', employeeNumber: 'E001', organisationId: 'org-a' },
    { id: 'root', organisationId: null, roles: ['SYSTEM_ADMIN'] },
  );

  assert.equal(result.organisationId, 'org-a');
});

test('employee manager assignment cannot create a reporting cycle', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    user: { findUnique: async () => ({ id: 'user-a' }) },
    department: { findFirst: async () => null },
    designation: { findFirst: async () => null },
    employee: {
      findUnique: async ({ where }: any) => {
        if (where.userId === 'user-a') return { id: 'employee-a', organisationId: 'org-a', managerId: 'employee-b' };
        if (where.id === 'employee-b') return { id: 'employee-b', organisationId: 'org-a', managerId: 'employee-a' };
        return null;
      },
      findFirst: async ({ where }: any) => ({ id: where.id, organisationId: where.organisationId }),
      upsert: async ({ update }: any) => ({ id: 'employee-a', organisationId: update.organisationId }),
    },
  };

  await assert.rejects(
    () => new OrganisationService(prisma as any).assignEmployee(
      { userId: 'user-a', employeeNumber: 'E001', organisationId: 'org-a', managerId: 'employee-b' },
      { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
    ),
    (error: any) => error?.response?.message === 'Manager assignment would create an organisational reporting cycle',
  );
});


test('department parent assignment cannot create a hierarchy cycle', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    department: {
      findUnique: async ({ where }: any) => {
        if (where.id === 'dept-a') return { id: 'dept-a', parentId: 'dept-b', organisationId: 'org-a' };
        if (where.id === 'dept-b') return { id: 'dept-b', parentId: 'dept-a', organisationId: 'org-a' };
        return null;
      },
      findFirst: async () => ({ id: 'dept-b', organisationId: 'org-a' }),
      update: async () => ({ id: 'dept-a' }),
    },
  };

  await assert.rejects(
    () => new OrganisationService(prisma as any, { record: async () => undefined } as any).updateDepartment(
      'dept-a',
      { parentId: 'dept-b' },
      { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
    ),
    (error: any) => error?.response?.message === 'Department parent assignment would create a hierarchy cycle',
  );
});

test('organisation creation rejects blank name or code', async () => {
  const service = new OrganisationService({ organisation: { create: async () => ({}) } } as any);

  await assert.rejects(
    () => service.createOrganisation({ name: '   ', code: 'ORG' }, { id: 'root', organisationId: null, roles: ['SYSTEM_ADMIN'] }),
    (error: any) => error?.response?.message === 'Organisation name is required',
  );
  await assert.rejects(
    () => service.createOrganisation({ name: 'Organisation', code: '   ' }, { id: 'root', organisationId: null, roles: ['SYSTEM_ADMIN'] }),
    (error: any) => error?.response?.message === 'Organisation code is required',
  );
});


test('deactivating an organisation revokes tenant user sessions but preserves system administrator sessions', async () => {
  const deleted: string[][] = [];
  const service = new OrganisationService({
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    $transaction: async (fn: any) => fn({
      organisation: { update: async ({ data }: any) => ({ id: 'org-a', isActive: data.isActive }) },
      user: { findMany: async () => [
        { id: 'user-a', roles: [{ role: { name: 'HR_ADMIN' } }] },
        { id: 'root', roles: [{ role: { name: 'SYSTEM_ADMIN' } }] },
      ] },
      session: { deleteMany: async ({ where }: any) => { deleted.push(where.userId.in); return { count: 1 }; } },
    }),
  } as any);
  const result = await service.updateOrganisation('org-a', { isActive: false }, { id: 'root', organisationId: null, roles: ['SYSTEM_ADMIN'] });
  assert.equal(result.isActive, false);
  assert.deepEqual(deleted, [['user-a']]);
});

test('scoped administrators cannot operate through an inactive organisation', async () => {
  const service = new OrganisationService({ organisation: { findUnique: async () => ({ id: 'org-a', isActive: false }) } } as any);
  await assert.rejects(
    () => service.listDepartments('org-a', { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] }),
    (error: any) => error?.response?.message === 'This organisation is inactive',
  );
});


test('exiting an employee disables the linked login and revokes sessions', async () => {
  const updates: any[] = [];
  const revoked: string[] = [];
  const service = new OrganisationService({
    employee: {
      findUnique: async () => ({ id: 'employee-a', organisationId: 'org-a', employmentStatus: 'ACTIVE', userId: 'user-a', user: { id: 'user-a', isActive: true } }),
    },
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    $transaction: async (fn: any) => fn({
      employee: {
        findUnique: async () => ({ id: 'employee-a', organisationId: 'org-a', employmentStatus: 'ACTIVE', userId: 'user-a', user: { id: 'user-a', isActive: true } }),
        updateMany: async ({ data }: any) => { updates.push(data); return { count: 1 }; },
      },
      user: { updateMany: async ({ where, data }: any) => { updates.push({ where, data }); return { count: 1 }; } },
      session: { deleteMany: async ({ where }: any) => { revoked.push(where.userId); return { count: 1 }; } },
    }),
  } as any, { record: async () => undefined } as any);
  const result = await service.updateEmployeeStatus('employee-a', 'EXITED', { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] });
  assert.equal(result?.user?.isActive, true);
  assert.deepEqual(updates, [
    { employmentStatus: 'EXITED' },
    { where: { id: 'user-a' }, data: { isActive: false } },
  ]);
  assert.deepEqual(revoked, ['user-a']);
});

test('returning an exited employee to active does not automatically reactivate the login account', async () => {
  const service = new OrganisationService({
    employee: { findUnique: async () => ({ id: 'employee-a', organisationId: 'org-a', employmentStatus: 'EXITED', userId: 'user-a', user: { id: 'user-a', isActive: false } }) },
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    $transaction: async (fn: any) => fn({
      employee: {
        findUnique: async () => ({ id: 'employee-a', organisationId: 'org-a', employmentStatus: 'EXITED', userId: 'user-a', user: { id: 'user-a', isActive: false } }),
        updateMany: async () => ({ count: 1 }),
      },
      user: { updateMany: async () => ({ count: 0 }) },
      session: { deleteMany: async () => ({ count: 0 }) },
      employee: { findUnique: async () => ({ id: 'employee-a', organisationId: 'org-a', employmentStatus: 'ACTIVE', userId: 'user-a', user: { id: 'user-a', isActive: false } }) },
    }),
  } as any, { record: async () => undefined } as any);
  const result = await service.updateEmployeeStatus('employee-a', 'ACTIVE', { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] });
  assert.equal(result?.employmentStatus, 'ACTIVE');
});

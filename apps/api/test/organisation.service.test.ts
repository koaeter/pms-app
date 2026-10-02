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
    session: { deleteMany: async () => ({ count: 1 }) },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      employee: { upsert: async ({ update }: any) => ({ id: 'employee-a', organisationId: update.organisationId, employeeNumber: update.employeeNumber }) },
      user: { update: async () => ({ id: 'user-a' }) },
      session: { deleteMany: async () => ({ count: 1 }) },
    }),
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

test('employee creation rejects an inactive manager', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    department: { findFirst: async () => null },
    designation: { findFirst: async () => null },
    employee: {
      findFirst: async () => ({ id: 'manager-a', organisationId: 'org-a', employmentStatus: 'SUSPENDED' }),
    },
  };

  await assert.rejects(
    () => new OrganisationService(prisma as any, { record: async () => undefined } as any).createEmployee(
      { employeeNumber: 'E002', organisationId: 'org-a', managerId: 'manager-a' },
      { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
    ),
    (error: any) => error?.response?.message === 'Only active employees can be assigned as managers',
  );
});


test('employee manager assignment cannot create a reporting cycle', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a' }) },
    user: { findUnique: async () => ({ id: 'user-a' }) },
    department: { findFirst: async () => null },
    designation: { findFirst: async () => null },
    employee: {
      findUnique: async ({ where }: any) => {
        if (where.userId === 'user-a') return { id: 'employee-a', organisationId: 'org-a', managerId: 'employee-b' };
        if (where.id === 'employee-b') return { id: 'employee-b', organisationId: 'org-a', managerId: 'employee-a' };
        return null;
      },
      findFirst: async ({ where }: any) => ({ id: where.id, organisationId: where.organisationId, employmentStatus: 'ACTIVE' }),
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


test('employee creation with account rejects inactive organisations', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: false }) },
  };

  await assert.rejects(
    () => new OrganisationService(prisma as any).createEmployeeWithAccount(
      { username: 'new-user', password: 'long-enough-password', firstName: 'New', lastName: 'User', employeeNumber: 'E004', organisationId: 'org-a' },
      { id: 'root', organisationId: null, roles: ['SYSTEM_ADMIN'] },
    ),
    (error: any) => error?.response?.message === 'Cannot provision a login account in an inactive organisation',
  );
});

test('employee creation with account cannot create a reporting cycle', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    department: { findFirst: async () => null },
    designation: { findFirst: async () => null },
    employee: {
      findFirst: async () => ({ id: 'manager-b', organisationId: 'org-a', employmentStatus: 'ACTIVE' }),
      findUnique: async ({ where }: any) => {
        if (where.id === 'manager-b') return { id: 'manager-b', organisationId: 'org-a', managerId: 'manager-c' };
        if (where.id === 'manager-c') return { id: 'manager-c', organisationId: 'org-a', managerId: 'manager-b' };
        return null;
      },
    },
  };

  await assert.rejects(
    () => new OrganisationService(prisma as any).createEmployeeWithAccount(
      { username: 'new-user', password: 'long-enough-password', firstName: 'New', lastName: 'User', employeeNumber: 'E003', organisationId: 'org-a', managerId: 'manager-b' },
      { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
    ),
    (error: any) => error?.response?.message === 'Manager assignment contains an organisational reporting cycle',
  );
});

test('suspending an employee disables the account and revokes sessions', async () => {
  let userUpdates = 0;
  let sessionDeletes = 0;
  const employee = { id: 'employee-a', organisationId: 'org-a', employmentStatus: 'ACTIVE', userId: 'user-a' };
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    employee: {
      findUnique: async () => employee,
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      employee: {
        findUnique: async () => employee,
        updateMany: async () => ({ count: 1 }),
      },
      user: {
        updateMany: async () => { userUpdates += 1; return { count: 1 }; },
      },
      session: {
        deleteMany: async () => { sessionDeletes += 1; return { count: 2 }; },
      },
    }),
  };

  await new OrganisationService(prisma as any, { record: async () => undefined } as any).updateEmployeeStatus(
    'employee-a',
    'SUSPENDED',
    { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
  );

  assert.equal(userUpdates, 1);
  assert.equal(sessionDeletes, 1);
});

test('returning an employee to active status does not reactivate a disabled account', async () => {
  let userUpdates = 0;
  const employee = { id: 'employee-a', organisationId: 'org-a', employmentStatus: 'SUSPENDED', userId: 'user-a' };
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: true }) },
    employee: {
      findUnique: async () => employee,
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      employee: {
        findUnique: async () => employee,
        updateMany: async () => ({ count: 1 }),
      },
      user: {
        updateMany: async () => { userUpdates += 1; return { count: 1 }; },
      },
      session: {
        deleteMany: async () => ({ count: 0 }),
      },
    }),
  };

  await new OrganisationService(prisma as any, { record: async () => undefined } as any).updateEmployeeStatus(
    'employee-a',
    'ACTIVE',
    { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] },
  );

  assert.equal(userUpdates, 0);
});

test('department parent assignment cannot create a hierarchy cycle', async () => {
  const prisma = {
    organisation: { findUnique: async () => ({ id: 'org-a' }) },
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


test('inactive organisation denies scoped access', async () => {
  const service = new OrganisationService({
    organisation: { findUnique: async () => ({ id: 'org-a', isActive: false }) },
  } as any);
  await assert.rejects(
    () => service['requireOrganisationAccess']('org-a', { id: 'admin-a', organisationId: 'org-a', roles: ['HR_ADMIN'] }),
    (error: any) => error?.response?.message === 'This organisation is inactive',
  );
});

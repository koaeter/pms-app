import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { OrganisationService } from '../src/organisation/organisation.service';

function basePrisma(existingOrganisationId: string | null) {
  return {
    organisation: { findUnique: async () => ({ id: 'org-a' }) },
    user: { findUnique: async () => ({ id: 'user-a' }) },
    department: { findFirst: async () => null },
    designation: { findFirst: async () => null },
    employee: {
      findUnique: async ({ where }: any) => existingOrganisationId
        ? { id: where.userId ? 'employee-a' : where.id, organisationId: existingOrganisationId, managerId: null }
        : null,
      upsert: async ({ update }: any) => ({ id: 'employee-a', organisationId: update.organisationId }),
    },
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

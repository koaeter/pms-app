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
        ? { id: where.id === 'employee-a' ? 'employee-a' : where.id, organisationId: existingOrganisationId, managerId: null }
        : null,
      upsert: async ({ update }: any) => ({ id: 'employee-a', organisationId: update.organisationId }),
    },
  };
}

test('scoped administrator cannot move an existing employee from another organisation', async () => {
  const service = new OrganisationService(basePrisma('org-b') as any);

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


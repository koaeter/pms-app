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
      findUnique: async () => existingOrganisationId ? { id: 'employee-a', organisationId: existingOrganisationId } : null,
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

  assert.equal(result.update.organisationId, 'org-a');
});

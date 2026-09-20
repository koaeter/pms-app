import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from '../src/reports/reports.service';

function service(organisationId = 'org-a') {
  return new ReportsService({
    organisation: {
      findUnique: async ({ where }: any) =>
        where.id === organisationId ? { id: organisationId, name: 'Org A', code: 'A' } : null,
    },
    performanceCycle: { findMany: async () => [] },
    performancePlan: { findMany: async () => [] },
    employee: {
      count: async () => 3,
      findUnique: async ({ where }: any) =>
        where.id === 'employee-a'
          ? {
              id: 'employee-a',
              organisationId: 'org-a',
              employeeNumber: 'E001',
              user: { firstName: 'A', lastName: 'User', username: 'a' },
              department: null,
              designation: null,
            }
          : null,
    },
  } as any);
}

test('reports reject cross-organisation summary access', async () => {
  await assert.rejects(
    () => service().performanceSummary('org-b', {
      id: 'admin-a',
      roles: ['PERFORMANCE_ADMIN'],
      permissions: ['reports.read'],
      organisationId: 'org-a',
    }),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('reports allow a scoped administrator to access its own organisation summary', async () => {
  const result = await service().performanceSummary('org-a', {
    id: 'admin-a',
    roles: ['PERFORMANCE_ADMIN'],
    permissions: ['reports.read'],
    organisationId: 'org-a',
  });
  assert.equal(result.organisation.id, 'org-a');
  assert.equal(result.employeeCount, 3);
});

test('employee history rejects an employee from another organisation', async () => {
  const crossOrg = new ReportsService({
    organisation: { findUnique: async () => ({ id: 'org-b' }) },
    employee: {
      findUnique: async () => ({
        id: 'employee-b',
        organisationId: 'org-b',
        employeeNumber: 'E002',
        user: { firstName: 'B', lastName: 'User', username: 'b' },
        department: null,
        designation: null,
      }),
    },
  } as any);

  await assert.rejects(
    () => crossOrg.employeeHistory('employee-b', {
      id: 'admin-a',
      roles: ['HR_ADMIN'],
      permissions: ['reports.read'],
      organisationId: 'org-a',
    }),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

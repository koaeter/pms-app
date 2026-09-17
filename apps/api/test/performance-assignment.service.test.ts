import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PerformanceAssignmentService } from '../src/performance/performance-assignment.service';

const admin = { id: 'admin-user', roles: ['PERFORMANCE_ADMIN'] };

function employee(id: string, organisationId = 'org-a', overrides: Record<string, unknown> = {}) {
  return {
    id,
    organisationId,
    employeeNumber: id,
    user: {
      id: `${id}-user`,
      firstName: id,
      lastName: 'User',
      username: id,
      isActive: true,
      roles: [{ role: { name: 'PERFORMANCE_REVIEWER' } }],
      ...overrides,
    },
  };
}

function service(planOverrides: Record<string, unknown> = {}, candidates: unknown[] = []) {
  const plan = {
    id: 'plan-1',
    employeeId: 'employee-1',
    reviewerId: null,
    finalAssessorId: null,
    employee: { id: 'employee-1', organisationId: 'org-a' },
    ...planOverrides,
  };

  const prisma = {
    performancePlan: {
      findUnique: async () => plan,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...plan, ...data }),
    },
    employee: {
      findMany: async () => candidates,
      findUnique: async ({ where }: { where: { userId: string } }) =>
        where.userId === 'reviewer-user' ? employee('reviewer-1') : null,
    },
  } as any;

  return new PerformanceAssignmentService(prisma);
}

test('assigned reviewer is authorised to assess the plan', async () => {
  await assert.doesNotReject(() => service({ reviewerId: 'reviewer-1' }).assertAssigned('plan-1', 'REVIEWER', 'reviewer-user'));
});

test('unassigned reviewer stage is rejected', async () => {
  await assert.rejects(
    () => service().assertAssigned('plan-1', 'REVIEWER', 'reviewer-user'),
    (error: unknown) => error instanceof ForbiddenException && /No reviewer has been assigned/.test((error as Error).message),
  );
});

test('different employee cannot act as assigned reviewer', async () => {
  await assert.rejects(
    () => service({ reviewerId: 'reviewer-1' }).assertAssigned('plan-1', 'REVIEWER', 'other-user'),
    (error: unknown) => error instanceof ForbiddenException && /not the assigned reviewer/.test((error as Error).message),
  );
});

test('cross-organisation assessor assignment is rejected', async () => {
  await assert.rejects(
    () => service({}, [employee('reviewer-1', 'org-b')]).assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /same organisation/.test((error as Error).message),
  );
});

test('inactive assessor assignment is rejected', async () => {
  const inactive = employee('reviewer-1');
  inactive.user.isActive = false;

  await assert.rejects(
    () => service({}, [inactive]).assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /active user accounts/.test((error as Error).message),
  );
});

test('employee cannot be assigned as their own reviewer', async () => {
  await assert.rejects(
    () => service({}, [employee('employee-1')]).assignAssessors('plan-1', { reviewerId: 'employee-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /own reviewer/.test((error as Error).message),
  );
});

test('reviewer and final assessor cannot be the same employee', async () => {
  await assert.rejects(
    () => service({}, [employee('reviewer-1')]).assignAssessors('plan-1', { reviewerId: 'reviewer-1', finalAssessorId: 'reviewer-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /must be different/.test((error as Error).message),
  );
});

test('non-administrator cannot assign assessors', async () => {
  await assert.rejects(
    () => service().assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, { id: 'employee-user', roles: ['EMPLOYEE'] }),
    ForbiddenException,
  );
});

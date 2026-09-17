import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PerformanceService, type CurrentUser } from '../src/performance/performance.service';

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    employeeId: 'employee-1',
    reviewerId: 'reviewer-1',
    finalAssessorId: 'final-1',
    status: 'IN_REVIEW',
    employee: { id: 'employee-1', managerId: 'manager-1' },
    cycle: { organisationId: 'org-a' },
    items: [],
    assessments: [
      { assessorType: 'SELF', status: 'SUBMITTED' },
      { assessorType: 'SUPERVISOR', status: 'SUBMITTED' },
      { assessorType: 'REVIEWER', status: 'SUBMITTED' },
    ],
    ...overrides,
  };
}

function makeService(plan: any) {
  const prisma = {
    employee: {
      findUnique: async ({ where }: { where: { userId: string } }) => ({
        id: where.userId === 'reviewer-user' ? 'reviewer-1' : where.userId === 'final-user' ? 'final-1' : 'other-1',
      }),
    },
    performanceAssessment: {
      findUnique: async () => null,
    },
  } as any;

  const service = new PerformanceService(prisma);
  (service as any).getPlan = async () => plan;
  return service;
}

const reviewer: CurrentUser = { id: 'reviewer-user', username: 'reviewer', roles: ['PERFORMANCE_REVIEWER'], permissions: [] };
const finalAssessor: CurrentUser = { id: 'final-user', username: 'final', roles: ['PERFORMANCE_REVIEWER'], permissions: [] };

const submit = (service: PerformanceService, user: CurrentUser, type: 'REVIEWER' | 'FINAL') =>
  service.submitAssessment('plan-1', user, type);

test('assigned reviewer passes service-level assignment authorization', async () => {
  await assert.rejects(
    () => submit(makeService(makePlan()), reviewer, 'REVIEWER'),
    (error: unknown) => error instanceof NotFoundException && /Assessment draft not found/.test((error as Error).message),
  );
});

test('unassigned reviewer is rejected by the service even with reviewer role', async () => {
  await assert.rejects(
    () => submit(makeService(makePlan({ reviewerId: null })), reviewer, 'REVIEWER'),
    (error: unknown) => error instanceof ForbiddenException && /No reviewer has been assigned/.test((error as Error).message),
  );
});

test('wrong reviewer is rejected by the service', async () => {
  await assert.rejects(
    () => submit(makeService(makePlan({ reviewerId: 'reviewer-2' })), reviewer, 'REVIEWER'),
    (error: unknown) => error instanceof ForbiddenException && /not the assigned reviewer/.test((error as Error).message),
  );
});

test('assigned final assessor passes service-level assignment authorization', async () => {
  await assert.rejects(
    () => submit(makeService(makePlan()), finalAssessor, 'FINAL'),
    (error: unknown) => error instanceof NotFoundException && /Assessment draft not found/.test((error as Error).message),
  );
});

test('unassigned final assessor is rejected by the service even with reviewer role', async () => {
  await assert.rejects(
    () => submit(makeService(makePlan({ finalAssessorId: null })), finalAssessor, 'FINAL'),
    (error: unknown) => error instanceof ForbiddenException && /No final assessor has been assigned/.test((error as Error).message),
  );
});

test('wrong final assessor is rejected by the service', async () => {
  await assert.rejects(
    () => submit(makeService(makePlan({ finalAssessorId: 'final-2' })), finalAssessor, 'FINAL'),
    (error: unknown) => error instanceof ForbiddenException && /not the assigned final assessor/.test((error as Error).message),
  );
});

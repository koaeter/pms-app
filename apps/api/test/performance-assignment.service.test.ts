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
    status: 'IN_REVIEW',
    cycle: { status: 'OPEN' },
    employeeId: 'employee-1',
    reviewerId: null,
    finalAssessorId: null,
    assessments: [],
    employee: { id: 'employee-1', organisationId: 'org-a' },
    ...planOverrides,
  };

  const prisma: any = {
    performancePlan: {
      findUnique: async () => plan,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...plan, ...data }),
      updateMany: async () => ({ count: 1 }),
    },
    employee: {
      findMany: async () => candidates,
      findUnique: async ({ where }: { where: { userId: string } }) => {
        if (where.userId === 'reviewer-user') return { ...employee('reviewer-1'), employmentStatus: 'ACTIVE' };
        if (where.userId === 'other-user') return { ...employee('other-1'), employmentStatus: 'ACTIVE' };
        if (where.userId === 'suspended-user') return { ...employee('suspended-1'), employmentStatus: 'SUSPENDED' };
        if (where.userId === 'inactive-user') return { ...employee('inactive-1'), employmentStatus: 'ACTIVE', user: { isActive: false } };
        return null;
      },
    },
  };
  prisma.$transaction = async (callback: (tx: any) => unknown, options: any) => {
    prisma.lastTransactionOptions = options;
    return callback(prisma);
  };

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


test('reviewer cannot be changed after reviewer assessment submission', async () => {
  await assert.rejects(
    () => service({
      reviewerId: 'reviewer-1',
      assessments: [{ assessorType: 'REVIEWER', status: 'SUBMITTED' }],
    }, [employee('reviewer-2')]).assignAssessors('plan-1', { reviewerId: 'reviewer-2' }, admin),
    (error: unknown) => error instanceof BadRequestException && /reviewer cannot be changed after/i.test((error as Error).message),
  );
});

test('final assessor cannot be changed after final assessment submission', async () => {
  await assert.rejects(
    () => service({
      finalAssessorId: 'reviewer-1',
      assessments: [{ assessorType: 'FINAL', status: 'APPROVED' }],
    }, [employee('reviewer-2')]).assignAssessors('plan-1', { finalAssessorId: 'reviewer-2' }, admin),
    (error: unknown) => error instanceof BadRequestException && /final assessor cannot be changed after/i.test((error as Error).message),
  );
});


test('suspended employee cannot act as assigned reviewer', async () => {
  await assert.rejects(
    () => service({ reviewerId: 'suspended-1' }).assertAssigned('plan-1', 'REVIEWER', 'suspended-user'),
    (error: unknown) => error instanceof ForbiddenException && /Only active employees/.test((error as Error).message),
  );
});

test('inactive account cannot act as assigned reviewer', async () => {
  await assert.rejects(
    () => service({ reviewerId: 'inactive-1' }).assertAssigned('plan-1', 'REVIEWER', 'inactive-user'),
    (error: unknown) => error instanceof ForbiddenException && /Only active employees/.test((error as Error).message),
  );
});


test('assessor assignment is frozen after plan approval', async () => {
  await assert.rejects(
    () => service({ status: 'APPROVED' }, [employee('reviewer-1')]).assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /after a performance plan has been approved or locked/i.test((error as Error).message),
  );
});

test('assessor assignment is frozen after plan locking', async () => {
  await assert.rejects(
    () => service({ status: 'LOCKED' }, [employee('reviewer-1')]).assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /after a performance plan has been approved or locked/i.test((error as Error).message),
  );
});

test('assessor assignment is frozen after the performance cycle closes', async () => {
  await assert.rejects(
    () => service({ cycle: { status: 'CLOSED' } }, [employee('reviewer-1')]).assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, admin),
    (error: unknown) => error instanceof BadRequestException && /after the performance cycle is closed/i.test((error as Error).message),
  );
});


test('assessor assignment uses a serializable transaction and conditional plan update', async () => {
  const plan = {
    id: 'plan-1',
    status: 'IN_REVIEW',
    cycle: { status: 'OPEN' },
    employeeId: 'employee-1',
    reviewerId: null,
    finalAssessorId: null,
    assessments: [],
    employee: { id: 'employee-1', organisationId: 'org-a' },
  };
  let isolationLevel: string | undefined;
  let where: any;
  const prisma: any = {
    performancePlan: {
      findUnique: async () => plan,
      updateMany: async (args: any) => { where = args.where; return { count: 1 }; },
    },
    employee: {
      findMany: async () => [ { ...employee('reviewer-1'), employmentStatus: 'ACTIVE' } ],
    },
    $transaction: async (callback: (tx: any) => unknown, options: any) => {
      isolationLevel = options?.isolationLevel;
      return callback(prisma);
    },
  };
  const service = new PerformanceAssignmentService(prisma);
  await service.assignAssessors('plan-1', { reviewerId: 'reviewer-1' }, admin);
  assert.equal(isolationLevel, 'Serializable');
  assert.deepEqual(where.status, { notIn: ['APPROVED', 'LOCKED'] });
  assert.deepEqual(where.cycle, { is: { status: { not: 'CLOSED' } } });
});

test('assessor assignment reports a concurrent serializable write conflict clearly', async () => {
  const prisma: any = {
    performancePlan: { findUnique: async () => ({
      id: 'plan-1', status: 'IN_REVIEW', cycle: { status: 'OPEN' },
      employeeId: 'employee-1', reviewerId: null, finalAssessorId: null,
      assessments: [], employee: { id: 'employee-1', organisationId: 'org-a' },
    }) },
    employee: { findMany: async () => [] },
    $transaction: async () => { throw { code: 'P2034' }; },
  };
  const service = new PerformanceAssignmentService(prisma);
  await assert.rejects(
    () => service.assignAssessors('plan-1', {}, admin),
    (error: unknown) => error instanceof BadRequestException && /changed concurrently/i.test((error as Error).message),
  );
});

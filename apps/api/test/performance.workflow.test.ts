import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { PerformanceService, type CurrentUser } from '../src/performance/performance.service';

const admin: CurrentUser = {
  id: 'admin-user',
  username: 'admin',
  roles: ['PERFORMANCE_ADMIN'],
  permissions: [],
};

function submitPlanService(plan: any) {
  const prisma = {
    performancePlan: {
      findUnique: async () => plan,
      update: async ({ data }: any) => ({ ...plan, ...data }),
      updateMany: async () => ({ count: 1 }),
    },
  } as any;
  return new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
}

test('plan submission requires an OPEN cycle', async () => {
  const plan = {
    id: 'plan-1',
    status: 'DRAFT',
    items: [{ weight: 100 }],
    cycle: { status: 'REVIEW', ratingScale: { levels: [] } },
  };

  await assert.rejects(
    () => submitPlanService(plan).submitPlan('plan-1'),
    (error: unknown) =>
      error instanceof BadRequestException &&
      /only be submitted while the performance cycle is open/i.test(error.message),
  );
});

test('plan submission requires weights to total 100 percent', async () => {
  const plan = {
    id: 'plan-1',
    status: 'DRAFT',
    items: [{ weight: 60 }, { weight: 30 }],
    cycle: { status: 'OPEN', ratingScale: { levels: [] } },
  };

  await assert.rejects(
    () => submitPlanService(plan).submitPlan('plan-1'),
    /weights must total 100/i,
  );
});

test('a valid draft plan can be submitted', async () => {
  const plan = {
    id: 'plan-1',
    status: 'DRAFT',
    items: [{ weight: 60 }, { weight: 40 }],
    cycle: { status: 'OPEN', ratingScale: { levels: [] } },
  };

  const result = await submitPlanService(plan).submitPlan('plan-1');
  assert.equal(result.status, 'SUBMITTED');
});

function approvalService(plan: any) {
  const prisma = {
    performancePlan: {
      findUnique: async () => plan,
      update: async ({ data }: any) => ({ ...plan, ...data }),
      updateMany: async () => ({ count: 1 }),
    },
    $transaction: async (callback: any) =>
      callback({
        performanceAssessment: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({ ...plan.finalAssessment, status: 'APPROVED' }),
        },
        performancePlan: {
          updateMany: async () => ({ count: 1 }),
        },
      }),
  } as any;
  return new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
}

test('final approval is blocked until a submitted final assessment exists', async () => {
  const plan = {
    id: 'plan-1',
    status: 'IN_REVIEW',
    assessments: [],
  };

  await assert.rejects(
    () => approvalService(plan).approveFinalAssessment('plan-1', admin),
    /submitted final assessment is required/i,
  );
});

test('submitted final assessment can be approved by an administrator', async () => {
  const plan = {
    id: 'plan-1',
    status: 'IN_REVIEW',
    assessments: [
      {
        id: 'assessment-final',
        assessorType: 'FINAL',
        status: 'SUBMITTED',
        overallScore: 87.5,
      },
    ],
    finalAssessment: {
      id: 'assessment-final',
      status: 'SUBMITTED',
      overallScore: 87.5,
    },
  };

  const result = await approvalService(plan).approveFinalAssessment('plan-1', admin);
  assert.equal(result.assessment?.status, 'APPROVED');
  assert.equal(result.planStatus, 'APPROVED');
  assert.equal(result.finalScore, 87.5);
});

test('only approved plans can be locked', async () => {
  const plan = { id: 'plan-1', status: 'IN_REVIEW', assessments: [] };

  await assert.rejects(
    () => approvalService(plan).lockPlan('plan-1', admin),
    /only approved plans can be locked/i,
  );
});

test('approved plans can be locked by an administrator', async () => {
  const plan = { id: 'plan-1', status: 'APPROVED', assessments: [] };

  const result = await approvalService(plan).lockPlan('plan-1', admin);
  assert.equal(result.status, 'LOCKED');
});

test('non-administrators cannot approve or lock performance plans', async () => {
  const user: CurrentUser = {
    id: 'employee-user',
    username: 'employee',
    roles: ['EMPLOYEE'],
    permissions: [],
  };
  const plan = {
    id: 'plan-1',
    status: 'APPROVED',
    assessments: [
      { id: 'assessment-final', assessorType: 'FINAL', status: 'SUBMITTED', overallScore: 80 },
    ],
    finalAssessment: { id: 'assessment-final', status: 'SUBMITTED', overallScore: 80 },
  };

  await assert.rejects(
    () => approvalService(plan).approveFinalAssessment('plan-1', user),
    /not authorised/i,
  );
  await assert.rejects(
    () => approvalService(plan).lockPlan('plan-1', user),
    /not authorised/i,
  );
});


test('final approval rejects a concurrent assessment change', async () => {
  const plan = {
    id: 'plan-1',
    status: 'IN_REVIEW',
    assessments: [
      { id: 'assessment-final', assessorType: 'FINAL', status: 'SUBMITTED', overallScore: 87.5 },
    ],
    finalAssessment: { id: 'assessment-final', status: 'SUBMITTED', overallScore: 87.5 },
  };
  const prisma = {
    performancePlan: { findUnique: async () => plan },
    $transaction: async (callback: any) => callback({
      performanceAssessment: {
        updateMany: async () => ({ count: 0 }),
      },
      performancePlan: { updateMany: async () => ({ count: 1 }) },
    }),
  } as any;
  const service = new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
  await assert.rejects(
    () => service.approveFinalAssessment('plan-1', admin),
    /final assessment changed before approval/i,
  );
});

test('final approval rejects a concurrent plan state change', async () => {
  const plan = {
    id: 'plan-1',
    status: 'IN_REVIEW',
    assessments: [
      { id: 'assessment-final', assessorType: 'FINAL', status: 'SUBMITTED', overallScore: 87.5 },
    ],
    finalAssessment: { id: 'assessment-final', status: 'SUBMITTED', overallScore: 87.5 },
  };
  const prisma = {
    performancePlan: { findUnique: async () => plan },
    $transaction: async (callback: any) => callback({
      performanceAssessment: {
        updateMany: async () => ({ count: 1 }),
        findUnique: async () => ({ ...plan.finalAssessment, status: 'APPROVED' }),
      },
      performancePlan: { updateMany: async () => ({ count: 0 }) },
    }),
  } as any;
  const service = new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
  await assert.rejects(
    () => service.approveFinalAssessment('plan-1', admin),
    /performance plan changed before approval/i,
  );
});


test('plan locking rejects a concurrent state change', async () => {
  const plan = { id: 'plan-1', status: 'APPROVED', assessments: [] };
  const prisma = {
    performancePlan: {
      findUnique: async () => plan,
      updateMany: async () => ({ count: 0 }),
    },
  } as any;
  const service = new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
  await assert.rejects(
    () => service.lockPlan('plan-1', admin),
    /performance plan changed before it could be locked/i,
  );
});

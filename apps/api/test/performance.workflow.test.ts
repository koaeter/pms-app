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
  let currentPlan = { ...plan };
  const prisma = {
    performancePlan: {
      findUnique: async () => currentPlan,
      update: async ({ data }: any) => {
        currentPlan = { ...currentPlan, ...data };
        return currentPlan;
      },
      updateMany: async ({ data }: any) => {
        currentPlan = { ...currentPlan, ...data };
        return { count: 1 };
      },
    },
    $transaction: async (callback: any) => callback({
      performancePlan: {
        findUnique: async () => currentPlan,
        updateMany: async ({ data }: any) => {
          currentPlan = { ...currentPlan, ...data };
          return { count: 1 };
        },
      },
    }),
  } as any;
  return new PerformanceService(prisma, { assertCanAssess: async () => ({}), assertCanAssessWithClient: async () => ({}) } as any);
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
  assert.equal(result!.status, 'SUBMITTED');
});

function approvalService(plan: any) {
  let currentPlan = { ...plan };
  const prisma = {
    performancePlan: {
      findUnique: async () => currentPlan,
      update: async ({ data }: any) => {
        currentPlan = { ...currentPlan, ...data };
        return currentPlan;
      },
      updateMany: async ({ data }: any) => {
        currentPlan = { ...currentPlan, ...data };
        return { count: 1 };
      },
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
  return new PerformanceService(prisma, { assertCanAssess: async () => ({}), assertCanAssessWithClient: async () => ({}) } as any);
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
  assert.equal(result!.status, 'LOCKED');
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


test('plan submission rejects a concurrent plan state change', async () => {
  const plan = {
    id: 'plan-1',
    status: 'DRAFT',
    items: [{ weight: 100 }],
    cycle: { status: 'OPEN', ratingScale: { levels: [] } },
  };
  const prisma = {
    $transaction: async (callback: any) => callback({
      performancePlan: {
        findUnique: async () => plan,
        updateMany: async () => ({ count: 0 }),
      },
    }),
  } as any;
  const service = new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
  await assert.rejects(
    () => service.submitPlan('plan-1'),
    /performance plan changed before submission/i,
  );
});


test('plan item creation uses serializable transaction and rechecks draft state', async () => {
  let status = 'DRAFT';
  let isolation: string | undefined;
  const prisma = {
    $transaction: async (callback: any, options: any) => {
      isolation = options?.isolationLevel;
      return callback({
        performancePlan: {
          findUnique: async () => ({ id: 'plan-1', status, cycle: { programmeId: 'programme-1' } }),
        },
        kpi: {
          findFirst: async () => ({ id: 'kpi-1', programmeId: 'programme-1' }),
        },
        performancePlanItem: {
          create: async ({ data }: any) => ({ id: 'item-1', ...data }),
        },
      });
    },
  } as any;
  const service = new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
  const result = await service.addPlanItem({
    planId: 'plan-1',
    type: 'KPI',
    kpiId: 'kpi-1',
    weight: 100,
  });
  assert.equal(isolation, 'Serializable');
  assert.equal(result.id, 'item-1');
});

test('plan item creation rejects when plan changes before the insert', async () => {
  const prisma = {
    $transaction: async (callback: any) => callback({
      performancePlan: {
        findUnique: async () => ({ id: 'plan-1', status: 'DRAFT', cycle: { programmeId: 'programme-1' } }),
      },
      kpi: {
        findFirst: async () => ({ id: 'kpi-1', programmeId: 'programme-1' }),
      },
      performancePlanItem: {
        create: async () => {
          throw new Error('insert should not run');
        },
      },
    }),
  } as any;
  const service = new PerformanceService(prisma, { assertCanAssess: async () => ({}) } as any);
  // The service performs a second plan read before creation; simulate the state transition.
  let reads = 0;
  prisma.$transaction = async (callback: any) => callback({
    performancePlan: {
      findUnique: async () => {
        reads += 1;
        return reads === 1
          ? { id: 'plan-1', status: 'DRAFT', cycle: { programmeId: 'programme-1' } }
          : { id: 'plan-1', status: 'SUBMITTED', cycle: { programmeId: 'programme-1' } };
      },
    },
    kpi: { findFirst: async () => ({ id: 'kpi-1', programmeId: 'programme-1' }) },
    performancePlanItem: { create: async () => { throw new Error('insert should not run'); } },
  });
  await assert.rejects(
    () => service.addPlanItem({ planId: 'plan-1', type: 'KPI', kpiId: 'kpi-1', weight: 100 }),
    /plan changed before the item could be added/i,
  );
});

test('assessment save uses a serializable transaction', async () => {
  const plan = {
    id: 'plan-1',
    status: 'SUBMITTED',
    employeeId: 'employee-1',
    cycle: { status: 'OPEN', organisationId: 'org-1', ratingScaleId: 'scale-1', ratingScale: { levels: [{ id: 'level-1', score: 5 }] } },
    items: [{ id: 'item-1', weight: 100 }],
    assessments: [],
  };
  let isolation: string | undefined;
  const prisma = {
    performancePlan: { findUnique: async () => plan },
    employee: { findUnique: async () => ({ id: 'employee-1' }) },
    ratingLevel: { findMany: async () => [{ id: 'level-1', scaleId: 'scale-1', score: 5 }] },
    ratingScale: { findMany: async () => [{ id: 'scale-1', organisationId: 'org-1', levels: [{ score: 5 }] }] },
    $transaction: async (callback: any, options: any) => {
      isolation = options?.isolationLevel;
      return callback({
        performancePlan: { findUnique: async () => plan },
        performanceAssessment: {
          findUnique: async () => null,
          create: async ({ data }: any) => ({ id: 'assessment-1', status: 'DRAFT', ...data, items: [] }),
        },
      });
    },
  } as any;
  const workflow = { assertCanAssess: async () => ({}), assertCanAssessWithClient: async () => ({}) };
  const service = new PerformanceService(prisma, workflow as any);
  const result = await service.upsertAssessment('plan-1', { ...admin, id: 'employee-user' }, {
    assessorType: 'SELF',
    items: [{ planItemId: 'item-1', ratingLevelId: 'level-1' }],
  });
  assert.equal(isolation, 'Serializable');
  assert.equal(result.assessment?.id, 'assessment-1');
});

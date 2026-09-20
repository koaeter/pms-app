import assert from 'node:assert/strict';
import test from 'node:test';
import { PerformanceAccessService } from '../src/performance/performance-access.service';

const organisation = { id: 'org-a' };
const plan = {
  id: 'plan-1',
  employee: {
    organisationId: 'org-a',
    userId: 'employee-user',
    managerId: 'manager-1',
    user: { id: 'employee-user' },
    manager: { userId: 'manager-user' },
  },
};

function service() {
  return new PerformanceAccessService({
    organisation: { findUnique: async () => organisation },
    performancePlan: { findUnique: async () => plan },
  } as any);
}

test('system administrators can read plans across organisations', async () => {
  const result = await service().requirePlanRead('plan-1', {
    id: 'sys-user',
    organisationId: 'org-other',
    roles: ['SYSTEM_ADMIN'],
  });
  assert.equal(result.id, 'plan-1');
});

test('scoped administrators cannot read another organisation', async () => {
  await assert.rejects(
    () => service().requirePlanRead('plan-1', {
      id: 'admin-user',
      organisationId: 'org-other',
      roles: ['PERFORMANCE_ADMIN'],
    }),
    /not authorised/,
  );
});

test('employees can read their own plan', async () => {
  const result = await service().requirePlanRead('plan-1', {
    id: 'employee-user',
    employeeId: 'employee-1',
    organisationId: 'org-a',
    roles: ['EMPLOYEE'],
  });
  assert.equal(result.id, 'plan-1');
});

test('direct managers can read their reports plans', async () => {
  const result = await service().requirePlanRead('plan-1', {
    id: 'manager-user',
    employeeId: 'manager-1',
    organisationId: 'org-a',
    roles: ['SUPERVISOR'],
  });
  assert.equal(result.id, 'plan-1');
});


test('scoped administrators cannot manage plans outside their organisation', async () => {
  await assert.rejects(
    () => service().requirePlanManagement('plan-1', {
      id: 'admin-user',
      organisationId: 'org-other',
      roles: ['PERFORMANCE_ADMIN'],
    }),
    /not authorised/,
  );
});

test('non-admin employees cannot manage a plan they can read', async () => {
  await assert.rejects(
    () => service().requirePlanManagement('plan-1', {
      id: 'employee-user',
      employeeId: 'employee-1',
      organisationId: 'org-a',
      roles: ['EMPLOYEE'],
    }),
    /only performance administrators can manage/i,
  );
});

test('visible-plan filtering never exposes another organisation to a scoped admin', () => {
  const plans = [
    { employee: { userId: 'a', managerId: null, organisationId: 'org-a' } },
    { employee: { userId: 'b', managerId: null, organisationId: 'org-b' } },
  ];
  const result = service().filterVisiblePlans(plans, {
    id: 'admin-user',
    organisationId: 'org-a',
    roles: ['PERFORMANCE_ADMIN'],
  });
  assert.deepEqual(result, [plans[0]]);
});

test('visible-plan filtering limits ordinary users to themselves and direct reports', () => {
  const plans = [
    { employee: { userId: 'employee-user', managerId: 'manager-1', organisationId: 'org-a' } },
    { employee: { userId: 'report-user', managerId: 'manager-1', organisationId: 'org-a' } },
    { employee: { userId: 'other-user', managerId: 'other-manager', organisationId: 'org-a' } },
  ];
  const result = service().filterVisiblePlans(plans, {
    id: 'manager-user',
    employeeId: 'manager-1',
    organisationId: 'org-a',
    roles: ['SUPERVISOR'],
  });
  assert.deepEqual(result, [plans[1]]);
});

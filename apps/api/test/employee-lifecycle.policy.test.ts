import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { EmployeeLifecyclePolicy } from '../src/lifecycle/employee-lifecycle.policy';

test('active and on-leave employees remain login eligible', () => {
  assert.equal(EmployeeLifecyclePolicy.isLoginEligible('ACTIVE'), true);
  assert.equal(EmployeeLifecyclePolicy.isLoginEligible('ON_LEAVE'), true);
  assert.equal(EmployeeLifecyclePolicy.isLoginEligible('SUSPENDED'), false);
  assert.equal(EmployeeLifecyclePolicy.isLoginEligible('EXITED'), false);
});

test('suspended and exited employees require disabled accounts', () => {
  assert.equal(EmployeeLifecyclePolicy.accountShouldBeActive('ACTIVE'), true);
  assert.equal(EmployeeLifecyclePolicy.accountShouldBeActive('ON_LEAVE'), true);
  assert.equal(EmployeeLifecyclePolicy.accountShouldBeActive('SUSPENDED'), false);
  assert.equal(EmployeeLifecyclePolicy.accountShouldBeActive('EXITED'), false);
});

test('only active employees may create plans or complete assessments', () => {
  assert.equal(EmployeeLifecyclePolicy.canCreatePerformancePlan('ACTIVE'), true);
  assert.equal(EmployeeLifecyclePolicy.canCreatePerformancePlan('ON_LEAVE'), false);
  assert.equal(EmployeeLifecyclePolicy.canAssessPerformance('ACTIVE'), true);
  assert.equal(EmployeeLifecyclePolicy.canAssessPerformance('ON_LEAVE'), false);

  assert.throws(() => EmployeeLifecyclePolicy.assertCanCreatePerformancePlan('ON_LEAVE'), ForbiddenException);
  assert.throws(() => EmployeeLifecyclePolicy.assertCanAssessPerformance('SUSPENDED'), ForbiddenException);
});

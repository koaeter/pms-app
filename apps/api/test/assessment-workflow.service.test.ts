import assert from 'node:assert/strict';
import test from 'node:test';
import { AssessmentWorkflowService } from '../src/performance/assessment-workflow.service';

function service(status: string, planStatus: string, assessments: Array<{ assessorType: string; status: string }>) {
  return new AssessmentWorkflowService({
    performancePlan: {
      findUnique: async () => ({
        id: 'plan-1',
        status: planStatus,
        cycle: { status },
        assessments,
      }),
    },
  } as any);
}

test('self assessment is blocked until the plan is submitted', async () => {
  await assert.rejects(
    () => service('OPEN', 'DRAFT', []).assertCanAssess('plan-1', 'SELF'),
    /must be submitted/,
  );
});

test('supervisor assessment requires submitted self assessment', async () => {
  await assert.rejects(
    () => service('OPEN', 'SUBMITTED', []).assertCanAssess('plan-1', 'SUPERVISOR'),
    /self assessment must be submitted/i,
  );
});

test('reviewer assessment requires submitted supervisor assessment', async () => {
  await assert.rejects(
    () => service('REVIEW', 'IN_REVIEW', [{ assessorType: 'SELF', status: 'SUBMITTED' }]).assertCanAssess('plan-1', 'REVIEWER'),
    /Supervisor assessment must be submitted/,
  );
});

test('final assessment requires submitted reviewer assessment', async () => {
  await assert.rejects(
    () => service('REVIEW', 'IN_REVIEW', [
      { assessorType: 'SELF', status: 'SUBMITTED' },
      { assessorType: 'SUPERVISOR', status: 'SUBMITTED' },
    ]).assertCanAssess('plan-1', 'FINAL'),
    /Reviewer assessment must be submitted/,
  );
});

test('draft cycles reject assessments', async () => {
  await assert.rejects(
    () => service('DRAFT', 'SUBMITTED', []).assertCanAssess('plan-1', 'SELF'),
    /only available during an open or review cycle/i,
  );
});

test('closed cycles reject assessments', async () => {
  await assert.rejects(
    () => service('CLOSED', 'SUBMITTED', []).assertCanAssess('plan-1', 'SELF'),
    /only available during an open or review cycle/i,
  );
});

test('workflow permits the next stage when the prerequisite is submitted', async () => {
  const result = await service('OPEN', 'IN_REVIEW', [
    { assessorType: 'SELF', status: 'SUBMITTED' },
    { assessorType: 'SUPERVISOR', status: 'SUBMITTED' },
    { assessorType: 'REVIEWER', status: 'SUBMITTED' },
  ]).assertCanAssess('plan-1', 'FINAL');

  assert.equal(result.id, 'plan-1');
});


test('transaction-aware workflow guard re-reads stage prerequisites', async () => {
  let selfSubmitted = false;
  const tx = {
    performancePlan: {
      findUnique: async () => ({
        id: 'plan-1',
        status: 'IN_REVIEW',
        cycle: { status: 'REVIEW' },
        assessments: selfSubmitted ? [{ assessorType: 'SELF', status: 'SUBMITTED' }] : [],
      }),
    },
  } as any;
  const workflow = new AssessmentWorkflowService({} as any);

  await assert.rejects(
    () => workflow.assertCanAssessWithClient(tx, 'plan-1', 'SUPERVISOR'),
    /self assessment must be submitted/i,
  );

  selfSubmitted = true;
  const result = await workflow.assertCanAssessWithClient(tx, 'plan-1', 'SUPERVISOR');
  assert.equal(result.id, 'plan-1');
});

test('transaction-aware workflow guard rejects a stage after its prerequisite is no longer submitted', async () => {
  const tx = {
    performancePlan: {
      findUnique: async () => ({
        id: 'plan-1',
        status: 'IN_REVIEW',
        cycle: { status: 'REVIEW' },
        assessments: [{ assessorType: 'SELF', status: 'DRAFT' }],
      }),
    },
  } as any;
  const workflow = new AssessmentWorkflowService({} as any);

  await assert.rejects(
    () => workflow.assertCanAssessWithClient(tx, 'plan-1', 'SUPERVISOR'),
    /self assessment must be submitted/i,
  );
});

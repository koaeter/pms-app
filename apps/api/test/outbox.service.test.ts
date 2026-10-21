import assert from 'node:assert/strict';
import test from 'node:test';
import { OutboxService } from '../src/outbox/outbox.service';

test('enqueue uses createMany with duplicate suppression for idempotency', async () => {
  let args: any;
  const service = new OutboxService({
    outboxEvent: {
      createMany: async (input: any) => { args = input; return { count: 1 }; },
    },
  } as any);

  const result = await service.enqueue(
    'assessment-submitted:plan-1:revision-3',
    'assessment.submitted',
    { planId: 'plan-1', revision: 3 },
  );

  assert.deepEqual(args, {
    data: [{
      eventKey: 'assessment-submitted:plan-1:revision-3',
      eventType: 'assessment.submitted',
      payload: { planId: 'plan-1', revision: 3 },
    }],
    skipDuplicates: true,
  });
  assert.deepEqual(result, { count: 1 });
});

test('enqueue uses the supplied transaction client so callers can commit it atomically', async () => {
  let transactionArgs: any;
  const service = new OutboxService({} as any);
  const transaction = {
    outboxEvent: {
      createMany: async (input: any) => { transactionArgs = input; return { count: 1 }; },
    },
  };

  await service.enqueue('cycle:cycle-1:opened', 'cycle.opened', { cycleId: 'cycle-1' }, transaction as any);

  assert.equal(transactionArgs.skipDuplicates, true);
  assert.equal(transactionArgs.data[0].eventKey, 'cycle:cycle-1:opened');
});

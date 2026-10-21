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


test('claimBatch uses a bounded transactional PostgreSQL claim query', async () => {
  let query: any;
  let transactionCalled = false;
  const prisma = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      transactionCalled = true;
      return callback({
        $queryRaw: async (sql: any) => { query = sql; return [{ id: 'event-1', attempts: 1 }]; },
      });
    },
  } as any;
  const service = new OutboxService(prisma);

  const result = await service.claimBatch(1000, 1);

  assert.equal(transactionCalled, true);
  assert.equal(result.length, 1);
  assert.equal(String(query.sql).includes('FOR UPDATE SKIP LOCKED'), true);
  assert.equal(String(query.sql).includes('RETURNING event.*'), true);
  assert.deepEqual(query.values, [10, 100]);
});

test('markProcessed only completes an event with the matching active lease', async () => {
  let args: any;
  const lockedAt = new Date('2026-10-21T10:00:00.000Z');
  const service = new OutboxService({
    outboxEvent: {
      updateMany: async (input: any) => { args = input; return { count: 1 }; },
    },
  } as any);

  await service.markProcessed('event-1', lockedAt);

  assert.deepEqual(args.where, { id: 'event-1', status: 'PROCESSING', lockedAt });
  assert.equal(args.data.status, 'PROCESSED');
  assert.equal(args.data.lockedAt, null);
});

test('recordFailure dead-letters events at the configured attempt limit', async () => {
  let args: any;
  const lockedAt = new Date('2026-10-21T10:00:00.000Z');
  const service = new OutboxService({
    outboxEvent: {
      findFirst: async () => ({ attempts: 3 }),
      updateMany: async (input: any) => { args = input; return { count: 1 }; },
    },
  } as any);

  await service.recordFailure('event-1', lockedAt, new Error('consumer failed'), 3);

  assert.deepEqual(args.where, { id: 'event-1', status: 'PROCESSING', lockedAt });
  assert.equal(args.data.status, 'DEAD_LETTER');
  assert.equal(args.data.lockedAt, null);
  assert.equal(args.data.lastError, 'consumer failed');
  assert.equal(args.data.availableAt, undefined);
});

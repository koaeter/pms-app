import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { PerformanceService } from '../src/performance/performance.service';

test('assessment history returns revisions newest first from the requested plan', async () => {
  const revisions = [
    { id: 'rev-2', action: 'SUBMITTED', createdAt: new Date('2026-09-30T10:00:00Z') },
    { id: 'rev-1', action: 'SAVED', createdAt: new Date('2026-09-30T09:00:00Z') },
  ];

  const prisma = {
    performancePlan: {
      findUnique: async () => ({ id: 'plan-1' }),
    },
    performanceAssessmentRevision: {
      findMany: async (args: any) => {
        assert.deepEqual(args.where, { assessment: { planId: 'plan-1' } });
        assert.equal(args.orderBy.createdAt, 'desc');
        return revisions;
      },
    },
  } as any;

  const service = new PerformanceService(prisma, {} as any);
  const result = await service.assessmentHistory('plan-1');

  assert.deepEqual(result, revisions);
});

test('assessment history rejects an unknown performance plan', async () => {
  const prisma = {
    performancePlan: {
      findUnique: async () => null,
    },
  } as any;

  const service = new PerformanceService(prisma, {} as any);

  await assert.rejects(
    () => service.assessmentHistory('missing-plan'),
    (error: unknown) => error instanceof NotFoundException && /performance plan not found/i.test(error.message),
  );
});

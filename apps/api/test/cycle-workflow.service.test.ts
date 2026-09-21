import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CycleWorkflowService } from '../src/performance/cycle-workflow.service';

function makeService(cycle: any, options: { programmeActive?: boolean; scaleOrg?: string; levelCount?: number } = {}) {
  let currentCycle = { ...cycle };
  const prisma = {
    performanceCycle: {
      findUnique: async () => currentCycle,
      updateMany: async ({ data }: any) => {
        currentCycle = { ...currentCycle, ...data };
        return { count: 1 };
      },
    },
    performanceProgramme: {
      findUnique: async () => ({ isActive: options.programmeActive ?? true }),
    },
    ratingScale: {
      findUnique: async () => options.scaleOrg === undefined ? { id: cycle.ratingScaleId, organisationId: cycle.organisationId } : { id: cycle.ratingScaleId, organisationId: options.scaleOrg },
    },
    ratingLevel: {
      count: async () => options.levelCount ?? 1,
    },
    performancePlan: {
      count: async () => 0,
    },
  } as any;
  prisma.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(prisma);
  return new CycleWorkflowService(prisma);
}

test('cycle cannot open without a rating scale', async () => {
  const cycle = { id: 'cycle-1', organisationId: 'org-a', programmeId: 'programme-1', ratingScaleId: null, status: 'DRAFT', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') };
  await assert.rejects(
    () => makeService(cycle).updateStatus('cycle-1', 'OPEN'),
    (error: unknown) => error instanceof BadRequestException && /rating scale must be configured/i.test(error.message),
  );
});

test('cycle cannot open with a rating scale from another organisation', async () => {
  const cycle = { id: 'cycle-1', organisationId: 'org-a', programmeId: 'programme-1', ratingScaleId: 'scale-1', status: 'DRAFT', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') };
  await assert.rejects(
    () => makeService(cycle, { scaleOrg: 'org-b' }).updateStatus('cycle-1', 'OPEN'),
    /rating scale must belong to the cycle organisation/i,
  );
});

test('cycle cannot open with an empty rating scale', async () => {
  const cycle = { id: 'cycle-1', organisationId: 'org-a', programmeId: 'programme-1', ratingScaleId: 'scale-1', status: 'DRAFT', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') };
  await assert.rejects(
    () => makeService(cycle, { levelCount: 0 }).updateStatus('cycle-1', 'OPEN'),
    /must contain at least one rating level/i,
  );
});

test('cycle with a valid rating scale can open', async () => {
  const cycle = { id: 'cycle-1', organisationId: 'org-a', programmeId: 'programme-1', ratingScaleId: 'scale-1', status: 'DRAFT', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') };
  const result = await makeService(cycle).updateStatus('cycle-1', 'OPEN');
  assert.equal(result.status, 'OPEN');
});


test('cycle transition rejects a concurrent state change', async () => {
  const cycle = { id: 'cycle-1', organisationId: 'org-a', programmeId: 'programme-1', ratingScaleId: 'scale-1', status: 'DRAFT', startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') };
  const prisma = {
    performanceCycle: {
      findUnique: async () => cycle,
      updateMany: async () => ({ count: 0 }),
    },
    performanceProgramme: { findUnique: async () => ({ isActive: true }) },
    ratingScale: { findUnique: async () => ({ id: 'scale-1', organisationId: 'org-a' }) },
    ratingLevel: { count: async () => 1 },
  } as any;
  prisma.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(prisma);
  const service = new CycleWorkflowService(prisma);
  await assert.rejects(
    () => service.updateStatus('cycle-1', 'OPEN'),
    /changed before this transition could be applied/i,
  );
});

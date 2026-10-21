import assert from 'node:assert/strict';
import test from 'node:test';
import { AuditService } from '../src/audit.service';

test('record associates the audit entry with the actor organisation', async () => {
  let createArgs: any;
  const service = new AuditService({
    user: {
      findUnique: async (args: any) => {
        assert.deepEqual(args, {
          where: { id: 'actor-1' },
          select: { employee: { select: { organisationId: true } } },
        });
        return { employee: { organisationId: 'org-1' } };
      },
    },
    auditLog: {
      create: async (args: any) => { createArgs = args; return args.data; },
    },
  } as any);

  await service.record('PERFORMANCE_PLAN_LOCKED', 'PerformancePlan', 'plan-1', 'actor-1', { source: 'test' });

  assert.deepEqual(createArgs.data, {
    action: 'PERFORMANCE_PLAN_LOCKED',
    entity: 'PerformancePlan',
    entityId: 'plan-1',
    actorId: 'actor-1',
    organisationId: 'org-1',
    metadata: { source: 'test' },
  });
});

test('record allows system-generated audit entries without an actor', async () => {
  let lookedUpActor = false;
  let createArgs: any;
  const service = new AuditService({
    user: { findUnique: async () => { lookedUpActor = true; return null; } },
    auditLog: { create: async (args: any) => { createArgs = args; return args.data; } },
  } as any);

  await service.record('SYSTEM_EVENT', 'PerformanceCycle', 'cycle-1', null);

  assert.equal(lookedUpActor, false);
  assert.deepEqual(createArgs.data, {
    action: 'SYSTEM_EVENT',
    entity: 'PerformanceCycle',
    entityId: 'cycle-1',
    actorId: null,
    organisationId: null,
    metadata: undefined,
  });
});

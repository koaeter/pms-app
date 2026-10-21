import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationsService } from '../src/notifications/notifications.service';

test('markRead scopes the update to the authenticated user', async () => {
  let args: any;
  const service = new NotificationsService({
    notification: {
      updateMany: async (input: any) => { args = input; return { count: 1 }; },
    },
  } as any);

  await service.markRead('user-a', 'notification-b');

  assert.deepEqual(args, {
    where: { id: 'notification-b', userId: 'user-a' },
    data: { isRead: true },
  });
});

test('markAllRead scopes the update to the authenticated user and unread rows', async () => {
  let args: any;
  const service = new NotificationsService({
    notification: {
      updateMany: async (input: any) => { args = input; return { count: 2 }; },
    },
  } as any);

  await service.markAllRead('user-a');

  assert.deepEqual(args, {
    where: { userId: 'user-a', isRead: false },
    data: { isRead: true },
  });
});

test('notifyMany creates one batch for unique recipients and skips empty batches', async () => {
  let args: any;
  const service = new NotificationsService({
    notification: {
      createMany: async (input: any) => { args = input; return { count: input.data.length }; },
    },
  } as any);

  const result = await service.notifyMany(
    ['user-a', 'user-b', 'user-a'],
    'Assessment submitted',
    'An assessment is ready.',
    '/performance/plan-a',
  );

  assert.deepEqual(args, {
    data: [
      { userId: 'user-a', title: 'Assessment submitted', message: 'An assessment is ready.', link: '/performance/plan-a' },
      { userId: 'user-b', title: 'Assessment submitted', message: 'An assessment is ready.', link: '/performance/plan-a' },
    ],
  });
  assert.deepEqual(result, { count: 2 });

  args = undefined;
  assert.deepEqual(await service.notifyMany([], 'title', 'message'), { count: 0 });
  assert.equal(args, undefined);
});

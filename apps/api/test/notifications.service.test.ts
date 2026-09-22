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

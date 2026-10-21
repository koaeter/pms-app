import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }

  async notify(userId: string, title: string, message: string, link?: string) {
    return this.prisma.notification.create({ data: { userId, title, message, link } });
  }

  async notifyMany(userIds: string[], title: string, message: string, link?: string) {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) return { count: 0 };

    return this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({ userId, title, message, link })),
    });
  }
}

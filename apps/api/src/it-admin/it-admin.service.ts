import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ItAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { employee: { organizationId } },
      select: {
        id: true,
        username: true,
        accountStatus: true,
        emailVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true } },
        roles: { select: { role: { select: { id: true, code: true, name: true, systemRole: true } }, expiresAt: true } },
      },
      orderBy: { username: 'asc' },
    });
  }

  async getUser(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, employee: { organizationId } },
      select: {
        id: true,
        username: true,
        accountStatus: true,
        emailVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        failedLoginCount: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true, phone: true } },
        roles: { select: { id: true, expiresAt: true, role: { select: { id: true, code: true, name: true, systemRole: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setUserStatus(organizationId: string, userId: string, status: AccountStatus, actorUserId: string) {
    const existing = await this.prisma.user.findFirst({ where: { id: userId, employee: { organizationId } }, select: { id: true, accountStatus: true } });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.prisma.user.update({ where: { id: userId }, data: { accountStatus: status } });
    if (status === AccountStatus.LOCKED || status === AccountStatus.DISABLED || status === AccountStatus.SUSPENDED) {
      await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({ userId: actorUserId, action: 'USER_STATUS_CHANGED', module: 'IT_ADMIN', entityType: 'User', entityId: userId, oldValues: { accountStatus: existing.accountStatus }, newValues: { accountStatus: status } });
    return { id: user.id, accountStatus: user.accountStatus };
  }

  async revokeSessions(organizationId: string, userId: string, actorUserId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, employee: { organizationId } }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const result = await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.record({ userId: actorUserId, action: 'USER_SESSIONS_REVOKED', module: 'IT_ADMIN', entityType: 'User', entityId: userId, newValues: { revokedCount: result.count } });
    return { revokedCount: result.count };
  }

  async listSessions(organizationId: string, userId?: string) {
    return this.prisma.session.findMany({
      where: { ...(userId ? { userId } : {}), user: { employee: { organizationId } } },
      select: { id: true, userId: true, ipAddress: true, userAgent: true, deviceInfo: true, createdAt: true, lastActivityAt: true, expiresAt: true, revokedAt: true, user: { select: { username: true } } },
      orderBy: { lastActivityAt: 'desc' },
      take: 200,
    });
  }

  async listAuthEvents(organizationId: string, userId?: string) {
    return this.prisma.authenticationEvent.findMany({
      where: { ...(userId ? { userId } : {}), user: { employee: { organizationId } } },
      select: { id: true, userId: true, eventType: true, success: true, ipAddress: true, userAgent: true, metadata: true, createdAt: true, user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listAuditLogs(organizationId: string) {
    return this.prisma.auditLog.findMany({
      where: { user: { employee: { organizationId } } },
      select: { id: true, userId: true, action: true, module: true, entityType: true, entityId: true, severity: true, oldValues: true, newValues: true, ipAddress: true, userAgent: true, requestId: true, createdAt: true, user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async health() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ok', uptimeSeconds: Math.floor(process.uptime()), responseMs: Date.now() - started, timestamp: new Date().toISOString() };
  }
}

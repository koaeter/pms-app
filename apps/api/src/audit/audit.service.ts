import { Injectable } from '@nestjs/common';
import { AuditSeverity } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: { userId?: string; action: string; module: string; entityType: string; entityId?: string; severity?: AuditSeverity; oldValues?: unknown; newValues?: unknown; ipAddress?: string; userAgent?: string; requestId?: string }) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        severity: input.severity ?? AuditSeverity.INFO,
        oldValues: input.oldValues as object | undefined,
        newValues: input.newValues as object | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
      },
    });
  }
}

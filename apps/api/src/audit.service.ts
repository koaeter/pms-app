import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    action: string,
    entity: string,
    entityId: string | null,
    actorId: string | null,
    metadata?: Prisma.InputJsonValue,
  ) {
    const actor = actorId
      ? await this.prisma.user.findUnique({ where: { id: actorId }, select: { employee: { select: { organisationId: true } } } })
      : null;
    const organisationId = actor?.employee?.organisationId ?? null;
    return this.prisma.auditLog.create({
      data: { action, entity, entityId, actorId, organisationId, metadata },
    });
  }
}

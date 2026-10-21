import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

const DEFAULT_LEASE_SECONDS = 60;
const DEFAULT_MAX_ATTEMPTS = 8;
const MAX_BACKOFF_SECONDS = 60 * 60;

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    eventKey: string,
    eventType: string,
    payload: Prisma.InputJsonValue,
    transaction?: Prisma.TransactionClient,
  ) {
    const client = transaction ?? this.prisma;
    return client.outboxEvent.createMany({
      data: [{ eventKey, eventType, payload }],
      skipDuplicates: true,
    });
  }

  /**
   * Atomically claims a bounded batch. PostgreSQL row locks prevent two API
   * replicas from claiming the same available event concurrently. Expired
   * PROCESSING leases are eligible for recovery after a crashed worker.
   */
  async claimBatch(limit = 25, leaseSeconds = DEFAULT_LEASE_SECONDS) {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 1, 100));
    const safeLease = Math.max(10, Math.min(Math.trunc(leaseSeconds) || DEFAULT_LEASE_SECONDS, 3600));

    return this.prisma.$transaction((tx) => tx.$queryRaw<Array<{
      id: string;
      eventKey: string;
      eventType: string;
      payload: Prisma.JsonValue;
      status: string;
      attempts: number;
      availableAt: Date;
      lockedAt: Date | null;
      createdAt: Date;
    }>>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE ("status" = 'PENDING' AND "availableAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - (${safeLease} * INTERVAL '1 second'))
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${safeLimit}
      )
      UPDATE "OutboxEvent" AS event
      SET "status" = 'PROCESSING',
          "lockedAt" = NOW(),
          "attempts" = event."attempts" + 1,
          "updatedAt" = NOW()
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event.*
    `));
  }

  async markProcessed(id: string, lockedAt: Date) {
    return this.prisma.outboxEvent.updateMany({
      where: { id, status: 'PROCESSING', lockedAt },
      data: { status: 'PROCESSED', processedAt: new Date(), lockedAt: null, lastError: null },
    });
  }

  async recordFailure(
    id: string,
    lockedAt: Date,
    error: unknown,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  ) {
    const event = await this.prisma.outboxEvent.findFirst({
      where: { id, status: 'PROCESSING', lockedAt },
      select: { attempts: true },
    });
    if (!event) return { count: 0 };

    const terminal = event.attempts >= Math.max(1, maxAttempts);
    const backoffSeconds = Math.min(2 ** Math.max(0, event.attempts - 1), MAX_BACKOFF_SECONDS);
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);

    return this.prisma.outboxEvent.updateMany({
      where: { id, status: 'PROCESSING', lockedAt },
      data: {
        status: terminal ? 'DEAD_LETTER' : 'PENDING',
        availableAt: terminal ? undefined : new Date(Date.now() + backoffSeconds * 1000),
        lockedAt: null,
        lastError: message,
      },
    });
  }
}

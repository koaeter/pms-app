import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

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
}

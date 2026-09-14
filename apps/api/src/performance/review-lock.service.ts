import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PerformanceReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReviewLockService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async lock(organizationId: string, reviewId: string, userId: string) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { id: reviewId, employee: { organizationId } },
    });
    if (!review) throw new NotFoundException('Performance review not found');
    if (review.status === PerformanceReviewStatus.LOCKED) {
      throw new ConflictException('Performance review is already locked');
    }
    if (review.status !== PerformanceReviewStatus.FINALIZED) {
      throw new ConflictException('Only finalized reviews can be locked');
    }

    const locked = await this.prisma.performanceReview.update({
      where: { id: review.id },
      data: { status: PerformanceReviewStatus.LOCKED },
    });

    await this.audit.record({
      userId,
      action: 'REVIEW_LOCKED',
      module: 'performance',
      entityType: 'PerformanceReview',
      entityId: review.id,
      oldValues: { status: PerformanceReviewStatus.FINALIZED },
      newValues: { status: PerformanceReviewStatus.LOCKED },
    });

    return locked;
  }
}

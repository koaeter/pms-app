import { ConflictException, NotFoundException } from '@nestjs/common';
import { PerformanceReviewStatus } from '@prisma/client';
import { ReviewLockService } from './review-lock.service';

describe('ReviewLockService', () => {
  const prisma = {
    performanceReview: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  let service: ReviewLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewLockService(prisma as never, audit as never);
  });

  it('locks a finalized review and records the historical boundary', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.FINALIZED });
    prisma.performanceReview.update.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.LOCKED });

    const result = await service.lock('org-1', 'review-1', 'admin-1');

    expect(prisma.performanceReview.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { status: PerformanceReviewStatus.LOCKED },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      action: 'REVIEW_LOCKED',
      entityId: 'review-1',
      oldValues: { status: PerformanceReviewStatus.FINALIZED },
      newValues: { status: PerformanceReviewStatus.LOCKED },
    }));
    expect(result.status).toBe(PerformanceReviewStatus.LOCKED);
  });

  it('rejects locking a non-finalized review', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.APPROVED });

    await expect(service.lock('org-1', 'review-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects locking an already locked review', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.LOCKED });

    await expect(service.lock('org-1', 'review-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects a review outside the actor organization', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(null);

    await expect(service.lock('org-1', 'review-1', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

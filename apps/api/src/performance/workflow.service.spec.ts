import { ConflictException } from '@nestjs/common';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { PerformanceReviewStatus, WorkflowStatus } from '@prisma/client';
import { WorkflowService } from './workflow.service';

describe('WorkflowService.finalize', () => {
  const prisma = {
    performanceReview: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { record: jest.fn() };
  let service: WorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkflowService(prisma as never, audit as never);
  });

  it('finalizes an approved, completed and fully assessed review', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({
      id: 'review-1', status: PerformanceReviewStatus.APPROVED,
      completedAt: new Date('2026-09-10T10:00:00Z'),
      kpis: [{ employeeScore: 80, supervisorScore: 85 }],
      competencies: [{ employeeRating: 90, supervisorRating: null }],
      workflowInstance: { status: WorkflowStatus.COMPLETED },
      scores: [{ overallScore: 86.25 }],
    });
    prisma.performanceReview.update.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.FINALIZED });

    const result = await service.finalize('org-1', 'review-1', 'user-1');

    expect(prisma.performanceReview.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { status: PerformanceReviewStatus.FINALIZED, completedAt: new Date('2026-09-10T10:00:00Z') },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', action: 'REVIEW_FINALIZED', entityId: 'review-1' }));
    expect(result.status).toBe(PerformanceReviewStatus.FINALIZED);
  });

  it('rejects finalization when the workflow is not complete', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({
      id: 'review-1', status: PerformanceReviewStatus.APPROVED, completedAt: null,
      kpis: [], competencies: [], workflowInstance: { status: WorkflowStatus.IN_PROGRESS }, scores: [{ overallScore: 80 }],
    });
    await expect(service.finalize('org-1', 'review-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
  });

  it('rejects finalization when an assessment is missing', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({
      id: 'review-1', status: PerformanceReviewStatus.APPROVED, completedAt: null,
      kpis: [{ employeeScore: null, supervisorScore: null }], competencies: [],
      workflowInstance: { status: WorkflowStatus.COMPLETED }, scores: [{ overallScore: 80 }],
    });
    await expect(service.finalize('org-1', 'review-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
  });

  it('rejects finalization when no final score exists', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({
      id: 'review-1', status: PerformanceReviewStatus.APPROVED, completedAt: null,
      kpis: [{ employeeScore: 80, supervisorScore: 85 }], competencies: [],
      workflowInstance: { status: WorkflowStatus.COMPLETED }, scores: [],
    });
    await expect(service.finalize('org-1', 'review-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
  });
});

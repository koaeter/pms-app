import { ConflictException } from '@nestjs/common';
import { PerformanceReviewStatus, WorkflowStatus } from '@prisma/client';
import { WorkflowService } from './workflow.service';

describe('WorkflowService review finalization', () => {
  const prisma = {
    performanceReview: { findFirst: jest.fn(), update: jest.fn() },
  };
  const audit = { record: jest.fn() };
  let service: WorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkflowService(prisma as never, audit as never);
  });

  const completeReview = {
    id: 'review-1',
    status: PerformanceReviewStatus.APPROVED,
    completedAt: new Date('2026-09-14T10:00:00Z'),
    kpis: [{ employeeScore: 82, supervisorScore: 84 }],
    competencies: [{ employeeRating: 4, supervisorRating: 4 }],
    workflowInstance: { status: WorkflowStatus.COMPLETED },
    scores: [{ overallScore: 83, calculatedAt: new Date('2026-09-14T10:01:00Z') }],
  };

  it('finalizes an approved completed review and records the actor', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(completeReview);
    prisma.performanceReview.update.mockResolvedValue({ ...completeReview, status: PerformanceReviewStatus.FINALIZED });

    const result = await service.finalize('org-1', 'review-1', 'pms-admin-user');

    expect(result.status).toBe(PerformanceReviewStatus.FINALIZED);
    expect(prisma.performanceReview.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { status: PerformanceReviewStatus.FINALIZED, completedAt: completeReview.completedAt },
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'pms-admin-user',
      action: 'REVIEW_FINALIZED',
      entityId: 'review-1',
      newValues: { status: PerformanceReviewStatus.FINALIZED },
    }));
  });

  it('rejects finalization when the review is not approved', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ ...completeReview, status: PerformanceReviewStatus.UNDER_REVIEW });

    await expect(service.finalize('org-1', 'review-1', 'pms-admin-user')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects finalization when the workflow is not completed', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({
      ...completeReview,
      workflowInstance: { status: WorkflowStatus.IN_PROGRESS },
    });

    await expect(service.finalize('org-1', 'review-1', 'pms-admin-user')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects finalization when no final performance score exists', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ ...completeReview, scores: [] });

    await expect(service.finalize('org-1', 'review-1', 'pms-admin-user')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects finalization when an assessment is incomplete', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({
      ...completeReview,
      kpis: [{ employeeScore: null, supervisorScore: null }],
    });

    await expect(service.finalize('org-1', 'review-1', 'pms-admin-user')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.performanceReview.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

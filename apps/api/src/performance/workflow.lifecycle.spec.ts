import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PerformanceReviewStatus, WorkflowActionType, WorkflowStatus } from '@prisma/client';
import { WorkflowService } from './workflow.service';

describe('WorkflowService review submission lifecycle', () => {
  const tx = {
    workflowInstance: { create: jest.fn() },
    performanceReview: { update: jest.fn() },
  };
  const prisma = {
    performanceReview: { findFirst: jest.fn(), findUnique: jest.fn() },
    workflow: { findFirst: jest.fn() },
    workflowInstance: { findUnique: jest.fn() },
    workflowStep: { findUnique: jest.fn() },
    delegation: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { record: jest.fn() };
  let service: WorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    service = new WorkflowService(prisma as never, audit as never);
    (service as any).notifyActor = jest.fn().mockResolvedValue(undefined);
  });

  const baseReview = (status: PerformanceReviewStatus) => ({
    id: 'review-1', employeeId: 'employee-1', reviewTypeId: 'type-1', status,
    employee: { user: { id: 'employee-user' } },
  });

  it('submits a complete employee review and records the authenticated actor', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(baseReview(PerformanceReviewStatus.DRAFT));
    prisma.performanceReview.findUnique.mockResolvedValue({
      id: 'review-1',
      kpis: [{ employeeScore: 80, weight: 60 }],
      competencies: [{ employeeRating: 4, weight: 40 }],
    });
    prisma.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1',
      steps: [{ id: 'step-1', stepOrder: 1 }],
    });
    tx.workflowInstance.create.mockResolvedValue({ id: 'instance-1', currentStep: { id: 'step-1' } });
    tx.performanceReview.update.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.SUBMITTED });

    const result = await service.submit('org-1', 'review-1', 'employee-user', { comment: 'Ready for review' });

    expect(result.id).toBe('instance-1');
    expect(tx.workflowInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workflowId: 'workflow-1',
        performanceReviewId: 'review-1',
        currentStepId: 'step-1',
        status: WorkflowStatus.IN_PROGRESS,
        actions: expect.objectContaining({ create: expect.objectContaining({ performedBy: 'employee-user', action: WorkflowActionType.SUBMIT }) }),
      }),
      include: { currentStep: true },
    }));
    expect(tx.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'review-1' },
      data: expect.objectContaining({ status: PerformanceReviewStatus.SUBMITTED }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'employee-user', action: 'REVIEW_SUBMITTED', entityId: 'review-1' }));
  });

  it('rejects submission by a different user before mutating the review', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(baseReview(PerformanceReviewStatus.DRAFT));

    await expect(service.submit('org-1', 'review-1', 'another-user', {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects incomplete employee assessments without changing status', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(baseReview(PerformanceReviewStatus.IN_PROGRESS));
    prisma.performanceReview.findUnique.mockResolvedValue({
      id: 'review-1',
      kpis: [{ employeeScore: null, weight: 60 }],
      competencies: [{ employeeRating: 4, weight: 40 }],
    });

    await expect(service.submit('org-1', 'review-1', 'employee-user', {})).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('resubmits a returned review using RESUBMITTED status and audit action', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(baseReview(PerformanceReviewStatus.RETURNED));
    prisma.performanceReview.findUnique.mockResolvedValue({
      id: 'review-1', kpis: [{ employeeScore: 90, weight: 100 }], competencies: [],
    });
    prisma.workflow.findFirst.mockResolvedValue({ id: 'workflow-1', steps: [{ id: 'step-1', stepOrder: 1 }] });
    tx.workflowInstance.create.mockResolvedValue({ id: 'instance-2', currentStep: { id: 'step-1' } });
    tx.performanceReview.update.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.RESUBMITTED });

    await service.submit('org-1', 'review-1', 'employee-user', {});

    expect(tx.workflowInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actions: expect.objectContaining({ create: expect.objectContaining({ action: WorkflowActionType.RESUBMIT }) }) }),
    }));
    expect(tx.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PerformanceReviewStatus.RESUBMITTED }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'employee-user', action: 'REVIEW_RESUBMITTED' }));
  });
});

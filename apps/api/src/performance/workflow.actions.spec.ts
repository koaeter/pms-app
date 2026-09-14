import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PerformanceReviewStatus, WorkflowActionType, WorkflowStatus } from '@prisma/client';
import { WorkflowService } from './workflow.service';

describe('WorkflowService workflow actions', () => {
  const tx = {
    workflowInstance: { update: jest.fn() },
    performanceReview: { update: jest.fn() },
  };
  const prisma = {
    performanceReview: { findFirst: jest.fn(), findUnique: jest.fn() },
    workflowInstance: { findUnique: jest.fn() },
    workflowStep: { findUnique: jest.fn() },
    delegation: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    employeeOrganizationalUnit: { findFirst: jest.fn() },
    organizationalUnit: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { record: jest.fn() };
  let service: WorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    service = new WorkflowService(prisma as never, audit as never);
    (service as any).notifyActor = jest.fn().mockResolvedValue(undefined);
    prisma.delegation.findFirst.mockResolvedValue(null);
  });

  const review = { id: 'review-1', employeeId: 'employee-1', status: PerformanceReviewStatus.SUBMITTED };
  const instance = {
    id: 'instance-1', currentStepId: 'step-1', status: WorkflowStatus.IN_PROGRESS,
    currentStep: { id: 'step-1', canReturn: true, canReject: true },
    workflow: { steps: [
      { id: 'step-1', stepOrder: 1, canReturn: true, canReject: true },
      { id: 'step-2', stepOrder: 2, canReturn: true, canReject: true },
    ] },
  };

  it('approves a step, advances to the next step, and records the actor', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(review);
    prisma.workflowInstance.findUnique.mockResolvedValue(instance);
    prisma.workflowStep.findUnique.mockResolvedValue({ id: 'step-1', actorType: 'SPECIFIC_USER', actorUserId: 'supervisor-user' });
    prisma.performanceReview.findUnique.mockResolvedValue({ id: 'review-1', employeeId: 'employee-1', employee: { user: { id: 'employee-user' } } });
    tx.workflowInstance.update.mockResolvedValue({ id: 'instance-1', currentStep: { id: 'step-2' } });
    tx.performanceReview.update.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.UNDER_REVIEW });

    const result = await service.act('org-1', 'review-1', 'supervisor-user', WorkflowActionType.APPROVE, {});

    expect(result.currentStep.id).toBe('step-2');
    expect(tx.workflowInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'instance-1' },
      data: expect.objectContaining({ status: WorkflowStatus.IN_PROGRESS, currentStepId: 'step-2' }),
    }));
    expect(tx.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PerformanceReviewStatus.UNDER_REVIEW }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'supervisor-user', action: 'REVIEW_APPROVE', entityId: 'review-1' }));
  });

  it('returns a review and moves it to RETURNED without advancing the workflow', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(review);
    prisma.workflowInstance.findUnique.mockResolvedValue(instance);
    prisma.workflowStep.findUnique.mockResolvedValue({ id: 'step-1', actorType: 'SPECIFIC_USER', actorUserId: 'supervisor-user' });
    prisma.performanceReview.findUnique.mockResolvedValue({ id: 'review-1', employeeId: 'employee-1', employee: { user: { id: 'employee-user' } } });
    tx.workflowInstance.update.mockResolvedValue({ id: 'instance-1', currentStep: null });
    tx.performanceReview.update.mockResolvedValue({ id: 'review-1', status: PerformanceReviewStatus.RETURNED });

    await service.act('org-1', 'review-1', 'supervisor-user', WorkflowActionType.RETURN, { comment: 'Please revise KPI evidence' });

    expect(tx.workflowInstance.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: WorkflowStatus.RETURNED, currentStepId: null }),
    }));
    expect(tx.performanceReview.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PerformanceReviewStatus.RETURNED }),
    }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ userId: 'supervisor-user', action: 'REVIEW_RETURN', entityId: 'review-1' }));
  });

  it('rejects an unauthorized workflow actor before mutation', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(review);
    prisma.workflowInstance.findUnique.mockResolvedValue(instance);
    prisma.workflowStep.findUnique.mockResolvedValue({ id: 'step-1', actorType: 'SPECIFIC_USER', actorUserId: 'different-user' });
    prisma.performanceReview.findUnique.mockResolvedValue({ id: 'review-1', employeeId: 'employee-1', employee: { user: { id: 'employee-user' } } });

    await expect(service.act('org-1', 'review-1', 'supervisor-user', WorkflowActionType.APPROVE, {})).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects return when the current workflow step disallows it', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(review);
    prisma.workflowInstance.findUnique.mockResolvedValue({ ...instance, currentStep: { ...instance.currentStep, canReturn: false } });
    prisma.workflowStep.findUnique.mockResolvedValue({ id: 'step-1', actorType: 'SPECIFIC_USER', actorUserId: 'supervisor-user' });
    prisma.performanceReview.findUnique.mockResolvedValue({ id: 'review-1', employeeId: 'employee-1', employee: { user: { id: 'employee-user' } } });

    await expect(service.act('org-1', 'review-1', 'supervisor-user', WorkflowActionType.RETURN, {})).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewAccessService } from './review-access.service';

describe('ReviewAccessService', () => {
  const prisma = {
    performanceReview: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    employeeOrganizationalUnit: { findMany: jest.fn(), findFirst: jest.fn() },
    organizationalUnit: { findMany: jest.fn() },
  };
  let service: ReviewAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewAccessService(prisma as never);
  });

  it('allows the review employee to read their own review', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ employeeId: 'employee-1', supervisorEmployeeIdSnapshot: 'supervisor-1', organizationUnitIdSnapshot: 'unit-1' });
    prisma.user.findUnique.mockResolvedValue({ employeeId: 'employee-1' });

    await expect(service.assertRead('org-1', 'review-1', 'user-1', ['EMPLOYEE'])).resolves.toBeUndefined();
    expect(prisma.employeeOrganizationalUnit.findMany).not.toHaveBeenCalled();
  });

  it('prevents a supervisor from reading a non-direct-report review in the same unit', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ employeeId: 'employee-2', supervisorEmployeeIdSnapshot: 'other-supervisor', organizationUnitIdSnapshot: 'unit-1' });
    prisma.user.findUnique.mockResolvedValue({ employeeId: 'supervisor-1' });

    await expect(service.assertRead('org-1', 'review-1', 'user-1', ['SUPERVISOR'])).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.employeeOrganizationalUnit.findMany).not.toHaveBeenCalled();
  });

  it('allows an HOD to read a review in a descendant organizational unit', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ employeeId: 'employee-2', supervisorEmployeeIdSnapshot: 'other-supervisor', organizationUnitIdSnapshot: 'child-unit' });
    prisma.user.findUnique.mockResolvedValue({ employeeId: 'hod-1' });
    prisma.employeeOrganizationalUnit.findMany.mockResolvedValue([{ organizationalUnitId: 'parent-unit' }]);
    prisma.organizationalUnit.findMany.mockResolvedValue([
      { id: 'parent-unit', parentId: null },
      { id: 'child-unit', parentId: 'parent-unit' },
    ]);

    await expect(service.assertRead('org-1', 'review-1', 'user-1', ['HOD'])).resolves.toBeUndefined();
  });

  it('allows the current snapshot supervisor to read the review even if their current assignment changed', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue({ employeeId: 'employee-2', supervisorEmployeeIdSnapshot: 'supervisor-1', organizationUnitIdSnapshot: 'old-unit' });
    prisma.user.findUnique.mockResolvedValue({ employeeId: 'supervisor-1' });

    await expect(service.assertRead('org-1', 'review-1', 'user-1', ['SUPERVISOR'])).resolves.toBeUndefined();
  });

  it('returns not found when the review is outside the organization', async () => {
    prisma.performanceReview.findFirst.mockResolvedValue(null);

    await expect(service.assertRead('org-1', 'review-1', 'user-1', ['EMPLOYEE'])).rejects.toBeInstanceOf(NotFoundException);
  });
});

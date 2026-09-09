import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReviewAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertRead(organizationId: string, reviewId: string, userId: string, roles: string[]) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } }, select: { employeeId: true, supervisorEmployeeIdSnapshot: true, organizationUnitIdSnapshot: true } });
    if (!review) throw new NotFoundException('Performance review not found');
    if (roles.includes('SUPER_ADMIN') || roles.includes('HR_OFFICER') || roles.includes('PMS_ADMIN') || roles.includes('AUDITOR')) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) throw new ForbiddenException('You are not authorized to view this review');
    if (user.employeeId === review.employeeId || user.employeeId === review.supervisorEmployeeIdSnapshot) return;
    if (!roles.includes('SUPERVISOR') && !roles.includes('HOD')) throw new ForbiddenException('You are not authorized to view this review');

    const assignments = await this.prisma.employeeOrganizationalUnit.findMany({ where: { supervisorEmployeeId: user.employeeId, isPrimary: true, endDate: null }, select: { organizationalUnitId: true } });
    const unitIds = new Set(assignments.map((assignment) => assignment.organizationalUnitId));
    if (roles.includes('HOD') && unitIds.size) {
      const units = await this.prisma.organizationalUnit.findMany({ where: { organizationId, active: true }, select: { id: true, parentId: true } });
      let changed = true;
      while (changed) {
        changed = false;
        for (const unit of units) {
          if (unit.parentId && unitIds.has(unit.parentId) && !unitIds.has(unit.id)) { unitIds.add(unit.id); changed = true; }
        }
      }
    }
    if (review.organizationUnitIdSnapshot && unitIds.has(review.organizationUnitIdSnapshot)) return;
    throw new ForbiddenException('You are not authorized to view this review');
  }

  async assertEmployee(organizationId: string, reviewId: string, userId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } }, select: { employeeId: true } });
    if (!review) throw new NotFoundException('Performance review not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user || user.employeeId !== review.employeeId) throw new ForbiddenException('Only the review employee may perform this action');
  }

  async assertSupervisor(organizationId: string, reviewId: string, userId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } }, select: { employeeId: true, supervisorEmployeeIdSnapshot: true } });
    if (!review) throw new NotFoundException('Performance review not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true, roles: { include: { role: true } } } });
    if (!user?.employeeId) throw new ForbiddenException('Only an assigned supervisor may perform this action');
    if (user.employeeId === review.supervisorEmployeeIdSnapshot) return;
    const elevated = user.roles.some((userRole) => ['HOD', 'SUPER_ADMIN'].includes(userRole.role.code));
    if (!elevated) throw new ForbiddenException('Only the assigned supervisor may perform this action');
    if (user.roles.some((userRole) => userRole.role.code === 'SUPER_ADMIN')) return;
    const assignments = await this.prisma.employeeOrganizationalUnit.findMany({ where: { supervisorEmployeeId: user.employeeId, isPrimary: true, endDate: null }, select: { organizationalUnitId: true } });
    const unitIds = new Set(assignments.map((assignment) => assignment.organizationalUnitId));
    if (!unitIds.size) throw new ForbiddenException('You are not assigned to an organizational unit');
    const units = await this.prisma.organizationalUnit.findMany({ where: { organizationId, active: true }, select: { id: true, parentId: true } });
    let changed = true;
    while (changed) { changed = false; for (const unit of units) if (unit.parentId && unitIds.has(unit.parentId) && !unitIds.has(unit.id)) { unitIds.add(unit.id); changed = true; } }
    const employeeAssignment = await this.prisma.employeeOrganizationalUnit.findFirst({ where: { employeeId: review.employeeId, organizationalUnitId: { in: [...unitIds] }, isPrimary: true, endDate: null }, select: { id: true } });
    if (!employeeAssignment) throw new ForbiddenException('You are not authorized to assess this review');
  }
}

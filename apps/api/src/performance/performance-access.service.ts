import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type ScopedUser = { id: string; employeeId?: string | null; organisationId?: string | null; roles: string[] };

@Injectable()
export class PerformanceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requirePlanRead(planId: string, user: ScopedUser) {
    const plan = await this.prisma.performancePlan.findUnique({
      where: { id: planId },
      include: { employee: { include: { user: true, manager: true } } },
    });
    if (!plan) throw new NotFoundException('Performance plan not found');

    if (this.isSystemAdmin(user) || (this.isScopedAdmin(user) && plan.employee.organisationId === user.organisationId)) return plan;
    if (plan.employee.userId === user.id) return plan;
    if (plan.employee.manager?.userId === user.id) return plan;
    throw new ForbiddenException('You are not authorised to view this performance plan');
  }

  async requirePlanManagement(planId: string, user: ScopedUser) {
    const plan = await this.requirePlanRead(planId, user);
    if (this.isSystemAdmin(user) || (this.isScopedAdmin(user) && plan.employee.organisationId === user.organisationId)) return plan;
    throw new ForbiddenException('Only performance administrators can manage this performance plan');
  }

  filterVisiblePlans<T extends { employee: { userId: string; managerId: string | null; organisationId?: string | null } }>(plans: T[], user: ScopedUser) {
    if (this.isSystemAdmin(user)) return plans;
    if (this.isScopedAdmin(user)) return plans.filter((plan) => plan.employee.organisationId === user.organisationId);
    return plans.filter((plan) => plan.employee.userId === user.id || plan.employee.managerId === user.employeeId);
  }

  private isSystemAdmin(user: ScopedUser) {
    return user.roles.includes('SYSTEM_ADMIN');
  }

  private isScopedAdmin(user: ScopedUser) {
    return user.roles.some((role) => ['PERFORMANCE_ADMIN', 'HR_ADMIN'].includes(role));
  }
}

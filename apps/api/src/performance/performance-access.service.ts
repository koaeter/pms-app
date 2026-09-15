import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type ScopedUser = { id: string; employeeId?: string | null; roles: string[] };

@Injectable()
export class PerformanceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requirePlanRead(planId: string, user: ScopedUser) {
    const plan = await this.prisma.performancePlan.findUnique({
      where: { id: planId },
      include: { employee: { include: { user: true, manager: true } } },
    });
    if (!plan) throw new NotFoundException('Performance plan not found');
    if (this.isAdmin(user) || plan.employee.userId === user.id || plan.employee.manager?.userId === user.id) return plan;
    throw new ForbiddenException('You are not authorised to view this performance plan');
  }

  async requirePlanManagement(planId: string, user: ScopedUser) {
    const plan = await this.requirePlanRead(planId, user);
    if (this.isAdmin(user)) return plan;
    throw new ForbiddenException('Only performance administrators can manage this performance plan');
  }

  filterVisiblePlans<T extends { employee: { userId: string; managerId: string | null } }>(plans: T[], user: ScopedUser) {
    if (this.isAdmin(user)) return plans;
    return plans.filter((plan) => plan.employee.userId === user.id || plan.employee.managerId === user.employeeId);
  }

  private isAdmin(user: ScopedUser) {
    return user.roles.some((role) => ['SYSTEM_ADMIN', 'PERFORMANCE_ADMIN', 'HR_ADMIN'].includes(role));
  }
}

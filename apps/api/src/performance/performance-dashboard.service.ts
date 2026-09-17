import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type DashboardUser = { id: string; employeeId?: string | null; organisationId?: string | null; roles: string[] };

@Injectable()
export class PerformanceDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async myPlans(user: DashboardUser) {
    const employee = await this.requireEmployee(user);
    return this.prisma.performancePlan.findMany({
      where: { employeeId: employee.id },
      include: {
        cycle: { include: { programme: true, reviewType: true } },
        reviewType: true,
        items: { include: { kpi: true, competency: true } },
        assessments: { orderBy: { createdAt: 'asc' }, include: { items: true } },
      },
      orderBy: { cycle: { startsAt: 'desc' } },
    });
  }

  async myTeam(user: DashboardUser) {
    const employee = await this.requireEmployee(user);
    const reports = await this.prisma.employee.findMany({
      where: { managerId: employee.id, organisationId: employee.organisationId ?? undefined },
      select: { id: true },
    });
    if (!reports.length) return [];
    return this.prisma.performancePlan.findMany({
      where: { employeeId: { in: reports.map((item) => item.id) }, cycle: { status: { in: ['OPEN', 'REVIEW'] } } },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } }, department: true, designation: true } },
        cycle: { include: { programme: true, reviewType: true } },
        reviewType: true,
        assessments: { orderBy: { createdAt: 'asc' }, include: { items: true } },
      },
      orderBy: [{ cycle: { startsAt: 'desc' } }, { employee: { user: { lastName: 'asc' } } }],
    });
  }

  async myHistory(user: DashboardUser) {
    const employee = await this.requireEmployee(user);
    return this.prisma.performancePlan.findMany({
      where: { employeeId: employee.id },
      include: {
        cycle: { include: { programme: true, reviewType: true } },
        reviewType: true,
        assessments: { where: { status: { in: ['SUBMITTED', 'APPROVED'] } }, orderBy: { createdAt: 'asc' }, include: { items: true } },
      },
      orderBy: { cycle: { startsAt: 'desc' } },
    });
  }

  private async requireEmployee(user: DashboardUser) {
    if (!user.employeeId) throw new ForbiddenException('Your account is not linked to an employee record');
    const employee = await this.prisma.employee.findUnique({ where: { id: user.employeeId } });
    if (!employee || employee.userId !== user.id) throw new NotFoundException('Employee record not found');
    return employee;
  }
}

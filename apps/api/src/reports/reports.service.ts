import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export type ReportsUser = { id: string; roles: string[]; permissions: string[]; organisationId?: string };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async performanceSummary(organisationId: string, user: ReportsUser) {
    await this.requireOrganisationAccess(organisationId, user);

    const [organisation, cycles, plans, employees] = await Promise.all([
      this.prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true, name: true, code: true } }),
      this.prisma.performanceCycle.findMany({ where: { organisationId }, orderBy: { startsAt: 'desc' }, include: { programme: { select: { name: true, code: true } }, reviewType: { select: { name: true } }, _count: { select: { plans: true } } } }),
      this.prisma.performancePlan.findMany({ where: { cycle: { organisationId } }, include: { assessments: { where: { assessorType: 'FINAL', status: 'APPROVED' }, select: { overallScore: true } } } }),
      this.prisma.employee.count({ where: { organisationId } }),
    ]);
    if (!organisation) throw new NotFoundException('Organisation not found');

    const statusCounts = plans.reduce<Record<string, number>>((counts, plan) => {
      counts[plan.status] = (counts[plan.status] ?? 0) + 1;
      return counts;
    }, {});
    const approvedScores = plans.flatMap((plan) => plan.assessments.map((assessment) => Number(assessment.overallScore))).filter(Number.isFinite);
    const averageApprovedScore = approvedScores.length ? approvedScores.reduce((sum, score) => sum + score, 0) / approvedScores.length : null;

    return {
      organisation,
      employeeCount: employees,
      planCount: plans.length,
      statusCounts,
      approvedPlanCount: approvedScores.length,
      averageApprovedScore: averageApprovedScore === null ? null : Number(averageApprovedScore.toFixed(2)),
      cycles: cycles.map((cycle) => ({ id: cycle.id, name: cycle.name, programme: cycle.programme, reviewType: cycle.reviewType, startsAt: cycle.startsAt, endsAt: cycle.endsAt, status: cycle.status, planCount: cycle._count.plans })),
    };
  }

  async employeeHistory(employeeId: string, user: ReportsUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, organisationId: true, employeeNumber: true, user: { select: { firstName: true, lastName: true, username: true } }, department: { select: { name: true } }, designation: { select: { name: true, grade: true } } } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.organisationId) throw new NotFoundException('Employee is not assigned to an organisation');
    await this.requireOrganisationAccess(employee.organisationId, user);

    return this.prisma.performancePlan.findMany({
      where: { employeeId },
      orderBy: { cycle: { startsAt: 'desc' } },
      include: {
        cycle: { select: { id: true, name: true, startsAt: true, endsAt: true, status: true, programme: { select: { name: true, code: true } }, reviewType: { select: { name: true, code: true } } } },
        assessments: { where: { assessorType: 'FINAL' }, select: { id: true, status: true, overallScore: true, comment: true, updatedAt: true } },
      },
    });
  }

  private async requireOrganisationAccess(organisationId: string, user: ReportsUser) {
    const exists = await this.prisma.organisation.findUnique({ where: { id: organisationId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Organisation not found');
    if (user.roles.includes('SYSTEM_ADMIN') || user.roles.includes('PERFORMANCE_ADMIN') || user.roles.includes('HR_ADMIN')) return;
    throw new ForbiddenException('You are not authorised to access organisation reports');
  }
}

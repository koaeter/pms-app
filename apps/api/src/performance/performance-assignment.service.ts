import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmployeeLifecyclePolicy } from '../lifecycle/employee-lifecycle.policy';

export type AssignmentUser = {
  id: string;
  roles: string[];
};

@Injectable()
export class PerformanceAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(organisationId: string, user: AssignmentUser) {
    this.assertAdmin(user);
    const employees = await this.prisma.employee.findMany({
      where: { organisationId, employmentStatus: 'ACTIVE', userId: { not: null }, user: { isActive: true } },
      include: {
        user: { include: { roles: { include: { role: true } } } },
        department: true,
        designation: true,
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });

    return employees
      .map((employee) => {
        if (!employee.user || !employee.user.roles.some(({ role }) =>
          ['PERFORMANCE_REVIEWER', 'SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role.name),
        )) return null;
        return {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.user.firstName,
          lastName: employee.user.lastName,
          department: employee.department?.name ?? null,
          designation: employee.designation?.name ?? null,
          roles: employee.user.roles.map(({ role }) => role.name),
        };
      })
      .filter((employee): employee is NonNullable<typeof employee> => employee !== null);
  }

  async assignAssessors(
    planId: string,
    data: { reviewerId?: string | null; finalAssessorId?: string | null },
    user: AssignmentUser,
  ) {
    this.assertAdmin(user);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.performancePlan.findUnique({
          where: { id: planId },
          include: { employee: true, reviewer: true, finalAssessor: true, cycle: true, assessments: { select: { assessorType: true, status: true } } },
        });
        if (!plan) throw new NotFoundException('Performance plan not found');
        if (!plan.employee.organisationId) throw new BadRequestException('Performance plan employee has no organisation');
        if (plan.status === 'APPROVED' || plan.status === 'LOCKED') {
          throw new BadRequestException('Assessors cannot be reassigned after a performance plan has been approved or locked');
        }
        if (plan.cycle.status === 'CLOSED') {
          throw new BadRequestException('Assessors cannot be reassigned after the performance cycle is closed');
        }

        const reviewerId = data.reviewerId === undefined ? plan.reviewerId : data.reviewerId;
        const finalAssessorId = data.finalAssessorId === undefined ? plan.finalAssessorId : data.finalAssessorId;

        const submittedStages = new Set(
          plan.assessments
            .filter((assessment: { status: string }) => assessment.status !== 'DRAFT')
            .map((assessment: { assessorType: string }) => assessment.assessorType),
        );
        if (submittedStages.has('REVIEWER') && reviewerId !== plan.reviewerId) {
          throw new BadRequestException('The reviewer cannot be changed after the reviewer assessment has been submitted');
        }
        if (submittedStages.has('FINAL') && finalAssessorId !== plan.finalAssessorId) {
          throw new BadRequestException('The final assessor cannot be changed after the final assessment has been submitted');
        }

        if (reviewerId && finalAssessorId && reviewerId === finalAssessorId) {
          throw new BadRequestException('Reviewer and final assessor must be different employees');
        }

        const ids = [...new Set([reviewerId, finalAssessorId].filter((id): id is string => Boolean(id)))];
        const candidates = ids.length
          ? await tx.employee.findMany({
              where: { id: { in: ids }, employmentStatus: 'ACTIVE', userId: { not: null }, user: { isActive: true } },
              include: { user: { include: { roles: { include: { role: true } } } } },
            })
          : [];

        if (candidates.length !== ids.length) throw new NotFoundException('One or more assigned assessors could not be found');

        for (const candidate of candidates) {
          if (!candidate.user) throw new BadRequestException('Assigned assessors must have user accounts');
          if (!EmployeeLifecyclePolicy.canBeAssignedAsAssessor(candidate.employmentStatus)) throw new BadRequestException('Assigned assessors must be active employees');
          if (!candidate.organisationId || candidate.organisationId !== plan.employee.organisationId) {
            throw new BadRequestException('Assigned assessors must belong to the same organisation as the performance plan');
          }
          if (candidate.id === plan.employeeId) throw new BadRequestException('The employee cannot be assigned as their own reviewer or final assessor');
          if (!candidate.user.isActive) throw new BadRequestException('Assigned assessors must have active user accounts');
          const eligible = candidate.user.roles.some(({ role }: any) =>
            ['PERFORMANCE_REVIEWER', 'SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role.name),
          );
          if (!eligible) throw new BadRequestException(`${candidate.user.firstName} ${candidate.user.lastName} is not eligible for reviewer/final assessment assignment`);
        }

        const result = await tx.performancePlan.updateMany({
          where: {
            id: planId,
            status: { notIn: ['APPROVED', 'LOCKED'] },
            cycle: { is: { status: { not: 'CLOSED' } } },
          },
          data: { reviewerId, finalAssessorId },
        });
        if (result.count !== 1) {
          throw new BadRequestException('The performance plan or cycle changed before assessor assignments could be saved');
        }

        const updated = await tx.performancePlan.findUnique({
          where: { id: planId },
          include: {
            reviewer: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
            finalAssessor: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
          },
        });
        if (!updated) throw new NotFoundException('Performance plan not found');
        return updated;
      }, { isolationLevel: 'Serializable' });
    } catch (error: any) {
      if (error?.code === 'P2034') {
        throw new BadRequestException('The performance plan changed concurrently; reload it and retry the assessor assignment');
      }
      throw error;
    }
  }

  async assertAssigned(planId: string, assessorType: 'REVIEWER' | 'FINAL', userId: string) {
    const plan = await this.prisma.performancePlan.findUnique({
      where: { id: planId },
      select: { reviewerId: true, finalAssessorId: true },
    });
    if (!plan) throw new NotFoundException('Performance plan not found');

    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: { select: { isActive: true } } },
    });
    if (!employee) throw new ForbiddenException('Authenticated user is not linked to an employee record');
    if (!employee.user?.isActive || !EmployeeLifecyclePolicy.canAssessPerformance(employee.employmentStatus)) {
      throw new ForbiddenException('Only active employees with active user accounts can complete performance assessments');
    }

    const assignedId = assessorType === 'REVIEWER' ? plan.reviewerId : plan.finalAssessorId;
    if (!assignedId) {
      throw new ForbiddenException(`No ${assessorType.toLowerCase()} has been assigned to this performance plan`);
    }
    if (assignedId !== employee.id) {
      throw new ForbiddenException(`You are not the assigned ${assessorType.toLowerCase()} for this performance plan`);
    }
  }

  private assertAdmin(user: AssignmentUser) {
    if (!user.roles.some((role) => ['SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role))) {
      throw new ForbiddenException('Only performance administrators can assign performance assessors');
    }
  }
}

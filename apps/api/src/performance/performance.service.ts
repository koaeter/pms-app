import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  listProgrammes(organisationId: string) {
    return this.prisma.performanceProgramme.findMany({
      where: { organisationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { cycles: true, kpis: true, competencies: true } } },
    });
  }

  async createProgramme(data: { organisationId: string; name: string; code: string; description?: string }) {
    await this.requireOrganisation(data.organisationId);
    return this.prisma.performanceProgramme.create({ data });
  }

  listReviewTypes(programmeId: string) {
    return this.prisma.reviewType.findMany({ where: { programmeId }, orderBy: { name: 'asc' } });
  }

  async createReviewType(data: { programmeId: string; name: string; code: string; description?: string }) {
    await this.requireProgramme(data.programmeId);
    return this.prisma.reviewType.create({ data });
  }

  listCycles(organisationId: string) {
    return this.prisma.performanceCycle.findMany({
      where: { organisationId },
      orderBy: { startsAt: 'desc' },
      include: { programme: true, reviewType: true },
    });
  }

  async createCycle(data: { organisationId: string; programmeId: string; reviewTypeId: string; name: string; startsAt: string; endsAt: string }) {
    await this.requireOrganisation(data.organisationId);
    const programme = await this.requireProgramme(data.programmeId);
    const reviewType = await this.prisma.reviewType.findFirst({ where: { id: data.reviewTypeId, programmeId: programme.id } });
    if (!reviewType) throw new NotFoundException('Review type not found in this programme');
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new BadRequestException('Cycle end date must be after the start date');
    }
    return this.prisma.performanceCycle.create({ data: { ...data, startsAt, endsAt } });
  }

  listKpis(programmeId: string) {
    return this.prisma.kpi.findMany({ where: { programmeId }, orderBy: { name: 'asc' } });
  }

  async createKpi(data: { programmeId: string; name: string; code: string; description?: string; defaultWeight?: number }) {
    await this.requireProgramme(data.programmeId);
    return this.prisma.kpi.create({ data: { ...data, defaultWeight: data.defaultWeight } });
  }

  listCompetencies(programmeId: string) {
    return this.prisma.competency.findMany({ where: { programmeId }, orderBy: { name: 'asc' } });
  }

  async createCompetency(data: { programmeId: string; name: string; code: string; description?: string; defaultWeight?: number }) {
    await this.requireProgramme(data.programmeId);
    return this.prisma.competency.create({ data: { ...data, defaultWeight: data.defaultWeight } });
  }

  listRatingScales(organisationId: string) {
    return this.prisma.ratingScale.findMany({ where: { organisationId }, include: { levels: { orderBy: { score: 'asc' } } }, orderBy: { name: 'asc' } });
  }

  async createRatingScale(data: { organisationId: string; name: string; description?: string; levels?: Array<{ name: string; score: number; description?: string }> }) {
    await this.requireOrganisation(data.organisationId);
    return this.prisma.ratingScale.create({
      data: {
        organisationId: data.organisationId,
        name: data.name,
        description: data.description,
        levels: data.levels ? { create: data.levels } : undefined,
      },
      include: { levels: true },
    });
  }

  listPlans(cycleId: string) {
    return this.prisma.performancePlan.findMany({
      where: { cycleId },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } }, department: true, designation: true } },
        reviewType: true,
        items: { include: { kpi: true, competency: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPlan(data: { employeeId: string; cycleId: string; reviewTypeId: string }) {
    const employee = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: data.cycleId } });
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    if (cycle.status === 'CLOSED') throw new BadRequestException('Cannot create a plan for a closed cycle');
    const reviewType = await this.prisma.reviewType.findFirst({ where: { id: data.reviewTypeId, programmeId: cycle.programmeId } });
    if (!reviewType) throw new NotFoundException('Review type does not belong to this cycle programme');
    return this.prisma.performancePlan.create({ data });
  }

  async addPlanItem(data: { planId: string; type: 'KPI' | 'COMPETENCY'; kpiId?: string; competencyId?: string; description?: string; weight: number; target?: string }) {
    const plan = await this.prisma.performancePlan.findUnique({ where: { id: data.planId }, include: { cycle: true } });
    if (!plan) throw new NotFoundException('Performance plan not found');
    if (plan.status !== 'DRAFT') throw new BadRequestException('Only draft plans can be changed');
    if (data.type === 'KPI') {
      if (!data.kpiId) throw new BadRequestException('kpiId is required for a KPI item');
      const kpi = await this.prisma.kpi.findFirst({ where: { id: data.kpiId, programmeId: plan.cycle.programmeId } });
      if (!kpi) throw new NotFoundException('KPI not found in the cycle programme');
    } else {
      if (!data.competencyId) throw new BadRequestException('competencyId is required for a competency item');
      const competency = await this.prisma.competency.findFirst({ where: { id: data.competencyId, programmeId: plan.cycle.programmeId } });
      if (!competency) throw new NotFoundException('Competency not found in the cycle programme');
    }
    return this.prisma.performancePlanItem.create({ data });
  }

  async submitPlan(planId: string) {
    const plan = await this.prisma.performancePlan.findUnique({ where: { id: planId }, include: { items: true } });
    if (!plan) throw new NotFoundException('Performance plan not found');
    if (plan.items.length === 0) throw new BadRequestException('A performance plan must contain at least one item');
    return this.prisma.performancePlan.update({ where: { id: planId }, data: { status: 'SUBMITTED' } });
  }

  private async requireOrganisation(id: string) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id } });
    if (!organisation) throw new NotFoundException('Organisation not found');
    return organisation;
  }

  private async requireProgramme(id: string) {
    const programme = await this.prisma.performanceProgramme.findUnique({ where: { id } });
    if (!programme) throw new NotFoundException('Performance programme not found');
    return programme;
  }
}

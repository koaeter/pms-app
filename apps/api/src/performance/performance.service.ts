import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AssessmentWorkflowService } from './assessment-workflow.service';

export type CurrentUser = {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService, private readonly workflow: AssessmentWorkflowService) {}

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
      include: { programme: true, reviewType: true, ratingScale: true },
    });
  }

  async createCycle(data: { organisationId: string; programmeId: string; reviewTypeId: string; ratingScaleId?: string; name: string; startsAt: string; endsAt: string }) {
    await this.requireOrganisation(data.organisationId);
    const programme = await this.requireProgramme(data.programmeId);
    if (programme.organisationId !== data.organisationId) throw new BadRequestException('Programme does not belong to this organisation');
    const reviewType = await this.prisma.reviewType.findFirst({ where: { id: data.reviewTypeId, programmeId: programme.id } });
    if (!reviewType) throw new NotFoundException('Review type not found in this programme');
    if (data.ratingScaleId) {
      const ratingScale = await this.prisma.ratingScale.findFirst({ where: { id: data.ratingScaleId, organisationId: data.organisationId } });
      if (!ratingScale) throw new NotFoundException('Rating scale not found in this organisation');
    }
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
    if (data.levels && data.levels.length === 0) throw new BadRequestException('Rating scale must contain at least one level');
    if (data.levels?.some((level) => !Number.isFinite(level.score) || level.score <= 0)) throw new BadRequestException('Rating level scores must be greater than zero');
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
        reviewer: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
        finalAssessor: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
        reviewType: true,
        items: { include: { kpi: true, competency: true } },
        assessments: { include: { assessor: { include: { user: { select: { firstName: true, lastName: true } } } }, items: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPlan(planId: string) {
    const plan = await this.prisma.performancePlan.findUnique({
      where: { id: planId },
      include: {
        employee: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } }, department: true, designation: true, manager: true } },
        reviewer: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
        finalAssessor: { include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } } },
        cycle: { include: { programme: true, reviewType: true, ratingScale: { include: { levels: true } } } },
        reviewType: true,
        items: { include: { kpi: true, competency: true } },
        assessments: {
          include: {
            assessor: { include: { user: { select: { firstName: true, lastName: true } } } },
            items: { include: { planItem: true, ratingScale: true, ratingLevel: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!plan) throw new NotFoundException('Performance plan not found');
    return plan;
  }

  async createPlan(data: { employeeId: string; cycleId: string; reviewTypeId: string }) {
    const employee = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: data.cycleId } });
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    if (cycle.status === 'CLOSED') throw new BadRequestException('Cannot create a plan for a closed cycle');
    if (!employee.organisationId || employee.organisationId !== cycle.organisationId) throw new BadRequestException('Employee does not belong to the cycle organisation');
    const reviewType = await this.prisma.reviewType.findFirst({ where: { id: data.reviewTypeId, programmeId: cycle.programmeId } });
    if (!reviewType) throw new NotFoundException('Review type does not belong to this cycle programme');
    try {
      return await this.prisma.performancePlan.create({ data });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new BadRequestException('A performance plan already exists for this employee, cycle, and review type');
      throw error;
    }
  }

  async addPlanItem(data: { planId: string; type: 'KPI' | 'COMPETENCY'; kpiId?: string; competencyId?: string; description?: string; weight: number; target?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.performancePlan.findUnique({ where: { id: data.planId }, include: { cycle: true } });
      if (!plan) throw new NotFoundException('Performance plan not found');
      if (plan.status !== 'DRAFT') throw new BadRequestException('Only draft plans can be changed');
      if (!Number.isFinite(data.weight) || data.weight <= 0 || data.weight > 100) throw new BadRequestException('Item weight must be greater than 0 and no more than 100');

      if (data.type === 'KPI') {
        if (!data.kpiId || data.competencyId) throw new BadRequestException('A KPI item requires kpiId and must not contain competencyId');
        const kpi = await tx.kpi.findFirst({ where: { id: data.kpiId, programmeId: plan.cycle.programmeId } });
        if (!kpi) throw new NotFoundException('KPI not found in the cycle programme');
      } else {
        if (!data.competencyId || data.kpiId) throw new BadRequestException('A competency item requires competencyId and must not contain kpiId');
        const competency = await tx.competency.findFirst({ where: { id: data.competencyId, programmeId: plan.cycle.programmeId } });
        if (!competency) throw new NotFoundException('Competency not found in the cycle programme');
      }

      const current = await tx.performancePlan.findUnique({ where: { id: data.planId }, select: { status: true } });
      if (!current || current.status !== 'DRAFT') throw new BadRequestException('The performance plan changed before the item could be added');
      return tx.performancePlanItem.create({ data });
    }, { isolationLevel: 'Serializable' });
  }
  async updatePlanItem(data: { itemId: string; description?: string; weight: number; target?: string }) {
    const item = await this.prisma.performancePlanItem.findUnique({ where: { id: data.itemId }, include: { plan: true } });
    if (!item) throw new NotFoundException('Performance plan item not found');
    if (item.plan.status !== 'DRAFT') throw new BadRequestException('Only draft plans can be changed');
    if (!Number.isFinite(data.weight) || data.weight <= 0 || data.weight > 100) throw new BadRequestException('Item weight must be greater than 0 and no more than 100');
    const result = await this.prisma.performancePlanItem.updateMany({
      where: { id: data.itemId, plan: { status: 'DRAFT' } },
      data: { description: data.description, weight: data.weight, target: data.target },
    });
    if (result.count !== 1) throw new BadRequestException('The performance plan changed before the item could be updated');
    return this.prisma.performancePlanItem.findUnique({ where: { id: data.itemId } });
  }

  async removePlanItem(itemId: string) {
    const item = await this.prisma.performancePlanItem.findUnique({ where: { id: itemId }, include: { plan: true } });
    if (!item) throw new NotFoundException('Performance plan item not found');
    if (item.plan.status !== 'DRAFT') throw new BadRequestException('Only draft plans can be changed');
    const result = await this.prisma.performancePlanItem.deleteMany({
      where: { id: itemId, plan: { status: 'DRAFT' } },
    });
    if (result.count !== 1) throw new BadRequestException('The performance plan changed before the item could be removed');
    return { id: itemId };
  }

  async submitPlan(planId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.performancePlan.findUnique({
        where: { id: planId },
        include: { items: true, cycle: { include: { ratingScale: { include: { levels: true } } } } },
      });
      if (!plan) throw new NotFoundException('Performance plan not found');
      if (plan.status !== 'DRAFT') throw new BadRequestException('Only draft plans can be submitted');
      if (plan.cycle.status !== 'OPEN') throw new BadRequestException('Plans can only be submitted while the performance cycle is open');
      if (plan.items.length === 0) throw new BadRequestException('A performance plan must contain at least one item');

      const totalWeight = plan.items.reduce((sum, item) => sum + Number(item.weight), 0);
      if (Math.abs(totalWeight - 100) > 0.01) throw new BadRequestException(`Plan item weights must total 100%; current total is ${totalWeight.toFixed(2)}%`);

      const result = await tx.performancePlan.updateMany({
        where: { id: planId, status: 'DRAFT' },
        data: { status: 'SUBMITTED' },
      });
      if (result.count !== 1) throw new BadRequestException('The performance plan changed before submission could be completed');

      return tx.performancePlan.findUnique({ where: { id: planId } });
    });
  }

  async upsertAssessment(
    planId: string,
    currentUser: CurrentUser,
    data: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL'; comment?: string; items: Array<{ planItemId: string; ratingLevelId: string; comment?: string }> },
  ) {
    const plan = await this.getPlan(planId);
    const assessor = await this.prisma.employee.findUnique({ where: { userId: currentUser.id } });
    if (!assessor) throw new BadRequestException('Authenticated user is not linked to an employee record');

    await this.authorizeAssessor(plan, assessor.id, currentUser.roles, data.assessorType);
    await this.workflow.assertCanAssess(planId, data.assessorType);

    const planItemIds = new Set(plan.items.map((item) => item.id));
    if (data.items.length !== plan.items.length || data.items.some((item) => !planItemIds.has(item.planItemId))) {
      throw new BadRequestException('Assessment must contain exactly one rating for every performance plan item');
    }
    if (new Set(data.items.map((item) => item.planItemId)).size !== data.items.length) {
      throw new BadRequestException('Each performance plan item can only be rated once');
    }

    if (!plan.cycle.ratingScaleId || !plan.cycle.ratingScale) throw new BadRequestException('A rating scale must be configured for this performance cycle before assessment');
    const ratingLevels = await this.prisma.ratingLevel.findMany({ where: { id: { in: data.items.map((item) => item.ratingLevelId) }, scaleId: plan.cycle.ratingScaleId }, include: { scale: true } });
    if (ratingLevels.length !== data.items.length) throw new BadRequestException('One or more ratings do not belong to the cycle rating scale');
    const scaleIds = [...new Set(ratingLevels.map((level) => level.scaleId))];
    const scales = await this.prisma.ratingScale.findMany({ where: { id: { in: scaleIds } }, include: { levels: true } });
    if (scales.some((scale) => scale.organisationId !== plan.cycle.organisationId)) throw new BadRequestException('Rating scale does not belong to the cycle organisation');
    const maxScoreByScale = new Map(scales.map((scale) => [scale.id, Math.max(...scale.levels.map((level) => Number(level.score)))]));
    const ratingMap = new Map(ratingLevels.map((level) => [level.id, level]));

    const scoredItems = data.items.map((item) => {
      const level = ratingMap.get(item.ratingLevelId)!;
      const maxScore = maxScoreByScale.get(level.scaleId) ?? 0;
      if (maxScore <= 0) throw new BadRequestException('Rating scale maximum score must be greater than zero');
      return {
        planItemId: item.planItemId,
        ratingScaleId: level.scaleId,
        ratingLevelId: level.id,
        score: (Number(level.score) / maxScore) * 100,
        comment: item.comment,
      };
    });

    const totalWeight = plan.items.reduce((sum, item) => sum + Number(item.weight), 0);
    if (Math.abs(totalWeight - 100) > 0.01) throw new BadRequestException('Plan item weights must total 100% before assessment');
    const itemById = new Map(plan.items.map((item) => [item.id, item]));
    const overallScore = scoredItems.reduce((sum, item) => sum + (item.score * Number(itemById.get(item.planItemId)!.weight)) / totalWeight, 0);

    const assessment = await this.prisma.$transaction(async (tx) => {
      const currentPlan = await tx.performancePlan.findUnique({ where: { id: planId }, include: { cycle: true } });
      if (!currentPlan) throw new NotFoundException('Performance plan not found');
      if (currentPlan.cycle.status !== 'OPEN' && currentPlan.cycle.status !== 'REVIEW') {
        throw new BadRequestException('Performance assessments are only available during an open or review cycle');
      }
      if (currentPlan.status === 'APPROVED' || currentPlan.status === 'LOCKED') {
        throw new BadRequestException('This performance plan is already finalised');
      }

      const existing = await tx.performanceAssessment.findUnique({
        where: { planId_assessorId_assessorType: { planId, assessorId: assessor.id, assessorType: data.assessorType } },
      });
      if (existing?.status === 'SUBMITTED' || existing?.status === 'APPROVED') {
        throw new BadRequestException('This assessment has already been submitted');
      }

      if (existing) {
        const result = await tx.performanceAssessment.updateMany({
          where: { id: existing.id, status: 'DRAFT' },
          data: { overallScore, comment: data.comment },
        });
        if (result.count !== 1) throw new BadRequestException('The assessment changed before it could be saved');
        await tx.performanceAssessmentItem.deleteMany({ where: { assessmentId: existing.id } });
        await tx.performanceAssessmentItem.createMany({ data: scoredItems.map((item) => ({ ...item, assessmentId: existing.id })) });
        return tx.performanceAssessment.findUnique({ where: { id: existing.id }, include: { items: true } });
      }

      try {
        return await tx.performanceAssessment.create({
          data: {
            planId,
            assessorId: assessor.id,
            assessorType: data.assessorType,
            overallScore,
            comment: data.comment,
            items: { create: scoredItems },
          },
          include: { items: true },
        });
      } catch (error) {
        if (error?.code === 'P2002') throw new BadRequestException('An assessment draft already exists for this stage');
        throw error;
      }
    }, { isolationLevel: 'Serializable' });

    return { assessment, workflow: this.workflowFor(plan, data.assessorType, 'DRAFT') };
  }

  async submitAssessment(planId: string, currentUser: CurrentUser, assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL') {
    const plan = await this.getPlan(planId);
    const assessor = await this.prisma.employee.findUnique({ where: { userId: currentUser.id } });
    if (!assessor) throw new BadRequestException('Authenticated user is not linked to an employee record');
    await this.authorizeAssessor(plan, assessor.id, currentUser.roles, assessorType);
    await this.workflow.assertCanAssess(planId, assessorType);

    const assessment = await this.prisma.performanceAssessment.findUnique({ where: { planId_assessorId_assessorType: { planId, assessorId: assessor.id, assessorType } }, include: { items: true } });
    if (!assessment) throw new NotFoundException('Assessment draft not found');
    if (assessment.status !== 'DRAFT') throw new BadRequestException('Assessment is not in draft status');
    if (assessment.items.length !== plan.items.length) throw new BadRequestException('Complete every performance plan item before submitting');

    const updated = await this.prisma.$transaction(async (tx) => {
      const assessmentResult = await tx.performanceAssessment.updateMany({
        where: { id: assessment.id, planId, assessorId: assessor.id, assessorType, status: 'DRAFT' },
        data: { status: 'SUBMITTED' },
      });
      if (assessmentResult.count !== 1) {
        throw new BadRequestException('The assessment changed before submission could be completed');
      }

      const planResult = await tx.performancePlan.updateMany({
        where: { id: planId, status: { in: ['SUBMITTED', 'IN_REVIEW'] } },
        data: { status: 'IN_REVIEW' },
      });
      if (planResult.count !== 1) {
        throw new BadRequestException('The performance plan changed before assessment submission could be completed');
      }

      return tx.performanceAssessment.findUnique({ where: { id: assessment.id } });
    });
    return { assessment: updated, workflow: this.workflowFor(plan, assessorType, 'SUBMITTED') };
  }

  async approveFinalAssessment(planId: string, currentUser: CurrentUser) {
    const plan = await this.getPlan(planId);
    if (!this.canAdministerWorkflow(currentUser.roles)) throw new BadRequestException('You are not authorised to approve final assessments');
    const finalAssessment = plan.assessments.find((assessment) => assessment.assessorType === 'FINAL' && assessment.status === 'SUBMITTED');
    if (!finalAssessment) throw new BadRequestException('A submitted final assessment is required before approval');
    const updated = await this.prisma.$transaction(async (tx) => {
      const assessmentResult = await tx.performanceAssessment.updateMany({
        where: { id: finalAssessment.id, planId, assessorType: 'FINAL', status: 'SUBMITTED' },
        data: { status: 'APPROVED' },
      });
      if (assessmentResult.count !== 1) {
        throw new BadRequestException('The final assessment changed before approval could be completed');
      }

      const planResult = await tx.performancePlan.updateMany({
        where: { id: planId, status: 'IN_REVIEW' },
        data: { status: 'APPROVED' },
      });
      if (planResult.count !== 1) {
        throw new BadRequestException('The performance plan changed before approval could be completed');
      }

      return tx.performanceAssessment.findUnique({ where: { id: finalAssessment.id } });
    });
    return { assessment: updated, planStatus: 'APPROVED', finalScore: Number(finalAssessment.overallScore ?? 0) };
  }

  async lockPlan(planId: string, currentUser: CurrentUser) {
    const plan = await this.getPlan(planId);
    if (!this.canAdministerWorkflow(currentUser.roles)) throw new BadRequestException('You are not authorised to lock performance plans');
    if (plan.status !== 'APPROVED') throw new BadRequestException('Only approved plans can be locked');
    const result = await this.prisma.performancePlan.updateMany({
      where: { id: planId, status: 'APPROVED' },
      data: { status: 'LOCKED' },
    });
    if (result.count !== 1) throw new BadRequestException('The performance plan changed before it could be locked');
    const lockedPlan = await this.prisma.performancePlan.findUnique({ where: { id: planId } });
    if (!lockedPlan) throw new NotFoundException('Performance plan not found');
    return lockedPlan;
  }

  private async authorizeAssessor(plan: any, assessorId: string, roles: string[], assessorType: string) {
    if (assessorType === 'SELF' && plan.employeeId !== assessorId) throw new ForbiddenException('Self assessment can only be completed by the employee');
    if (assessorType === 'SUPERVISOR' && plan.employee.managerId !== assessorId) throw new ForbiddenException('Supervisor assessment can only be completed by the employee manager');

    if (assessorType === 'REVIEWER') {
      if (!plan.reviewerId) throw new ForbiddenException('No reviewer has been assigned to this performance plan');
      if (plan.reviewerId !== assessorId) throw new ForbiddenException('You are not the assigned reviewer for this performance plan');
      if (!this.canAdministerWorkflow(roles) && !roles.includes('PERFORMANCE_REVIEWER')) {
        throw new ForbiddenException('You are not authorised for the reviewer assessment stage');
      }
    }

    if (assessorType === 'FINAL') {
      if (!plan.finalAssessorId) throw new ForbiddenException('No final assessor has been assigned to this performance plan');
      if (plan.finalAssessorId !== assessorId) throw new ForbiddenException('You are not the assigned final assessor for this performance plan');
      if (!this.canAdministerWorkflow(roles) && !roles.includes('PERFORMANCE_REVIEWER')) {
        throw new ForbiddenException('You are not authorised for the final assessment stage');
      }
    }
  }


  private workflowFor(plan: any, assessorType: string, status: string) {
    const submitted = new Set(plan.assessments.filter((assessment: any) => assessment.status !== 'DRAFT').map((assessment: any) => assessment.assessorType));
    if (status === 'SUBMITTED') submitted.add(assessorType);
    return {
      self: submitted.has('SELF') ? 'COMPLETED' : 'PENDING',
      supervisor: submitted.has('SUPERVISOR') ? 'COMPLETED' : submitted.has('SELF') ? 'PENDING' : 'BLOCKED',
      reviewer: submitted.has('REVIEWER') ? 'COMPLETED' : submitted.has('SUPERVISOR') ? 'PENDING' : 'BLOCKED',
      final: submitted.has('FINAL') ? 'COMPLETED' : submitted.has('REVIEWER') ? 'PENDING' : 'BLOCKED',
      approval: plan.status === 'APPROVED' ? 'COMPLETED' : submitted.has('FINAL') ? 'PENDING' : 'BLOCKED',
    };
  }

  private canAdministerWorkflow(roles: string[]) {
    return ['SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].some((role) => roles.includes(role));
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

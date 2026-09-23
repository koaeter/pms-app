import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma.service';
import { PerformanceAccessService } from './performance-access.service';
import { AssessmentWorkflowService } from './assessment-workflow.service';
import { PerformanceAssignmentService } from './performance-assignment.service';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly service: PerformanceService,
    private readonly access: PerformanceAccessService,
    private readonly audit: AuditService,
    private readonly workflow: AssessmentWorkflowService,
    private readonly assignments: PerformanceAssignmentService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('organisations/:organisationId/programmes') @RequirePermissions('performance.read')
  async programmes(@Param('organisationId') organisationId: string, @Req() request: { user: any }) { await this.access.requireOrganisationAccess(organisationId, request.user); return this.service.listProgrammes(organisationId); }
  @Post('organisations/:organisationId/programmes') @RequirePermissions('performance.manage')
  async createProgramme(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { name: string; code: string; description?: string }) { await this.access.requireOrganisationAccess(organisationId, request.user); return this.service.createProgramme({ ...body, organisationId }); }
  @Get('programmes/:programmeId/review-types') @RequirePermissions('performance.read')
  async reviewTypes(@Param('programmeId') programmeId: string, @Req() request: { user: any }) { await this.access.requireProgrammeAccess(programmeId, request.user); return this.service.listReviewTypes(programmeId); }
  @Post('programmes/:programmeId/review-types') @RequirePermissions('performance.manage')
  async createReviewType(@Param('programmeId') programmeId: string, @Req() request: { user: any }, @Body() body: { name: string; code: string; description?: string }) { await this.access.requireProgrammeAccess(programmeId, request.user); return this.service.createReviewType({ ...body, programmeId }); }
  @Get('organisations/:organisationId/cycles') @RequirePermissions('performance.read')
  async cycles(@Param('organisationId') organisationId: string, @Req() request: { user: any }) { await this.access.requireOrganisationAccess(organisationId, request.user); return this.service.listCycles(organisationId); }
  @Post('organisations/:organisationId/cycles') @RequirePermissions('performance.manage')
  async createCycle(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { programmeId: string; reviewTypeId: string; ratingScaleId?: string; name: string; startsAt: string; endsAt: string }) { await this.access.requireOrganisationAccess(organisationId, request.user); return this.service.createCycle({ ...body, organisationId }); }
  @Get('programmes/:programmeId/kpis') @RequirePermissions('performance.read')
  async kpis(@Param('programmeId') programmeId: string, @Req() request: { user: any }) { await this.access.requireProgrammeAccess(programmeId, request.user); return this.service.listKpis(programmeId); }
  @Post('programmes/:programmeId/kpis') @RequirePermissions('performance.manage')
  async createKpi(@Param('programmeId') programmeId: string, @Req() request: { user: any }, @Body() body: { name: string; code: string; description?: string; defaultWeight?: number }) { await this.access.requireProgrammeAccess(programmeId, request.user); return this.service.createKpi({ ...body, programmeId }); }
  @Get('programmes/:programmeId/competencies') @RequirePermissions('performance.read')
  async competencies(@Param('programmeId') programmeId: string, @Req() request: { user: any }) { await this.access.requireProgrammeAccess(programmeId, request.user); return this.service.listCompetencies(programmeId); }
  @Post('programmes/:programmeId/competencies') @RequirePermissions('performance.manage')
  async createCompetency(@Param('programmeId') programmeId: string, @Req() request: { user: any }, @Body() body: { name: string; code: string; description?: string; defaultWeight?: number }) { await this.access.requireProgrammeAccess(programmeId, request.user); return this.service.createCompetency({ ...body, programmeId }); }
  @Get('organisations/:organisationId/rating-scales') @RequirePermissions('performance.read')
  async ratingScales(@Param('organisationId') organisationId: string, @Req() request: { user: any }) { await this.access.requireOrganisationAccess(organisationId, request.user); return this.service.listRatingScales(organisationId); }
  @Post('organisations/:organisationId/rating-scales') @RequirePermissions('performance.manage')
  async createRatingScale(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { name: string; description?: string; levels?: Array<{ name: string; score: number; description?: string }> }) { await this.access.requireOrganisationAccess(organisationId, request.user); return this.service.createRatingScale({ ...body, organisationId }); }

  @Get('organisations/:organisationId/assessor-candidates') @RequirePermissions('performance.manage')
  async assessorCandidates(@Param('organisationId') organisationId: string, @Req() request: { user: any }) {
    await this.access.requireOrganisationAccess(organisationId, request.user);
    return this.assignments.listCandidates(organisationId, request.user);
  }

  @Get('cycles/:cycleId/plans') @RequirePermissions('performance.read')
  async plans(@Param('cycleId') cycleId: string, @Req() request: { user: any }) {
    await this.access.requireCycleAccess(cycleId, request.user);
    const plans = await this.service.listPlans(cycleId);
    return this.access.filterVisiblePlans(plans, request.user);
  }

  @Post('cycles/:cycleId/plans') @RequirePermissions('performance.manage')
  async createPlan(@Param('cycleId') cycleId: string, @Req() request: { user: any }, @Body() body: { employeeId: string; reviewTypeId: string }) {
    await this.access.requireCycleAccess(cycleId, request.user);
    const plan = await this.service.createPlan({ ...body, cycleId });
    await this.audit.record('PERFORMANCE_PLAN_CREATED', 'PerformancePlan', plan.id, request.user.id, { employeeId: body.employeeId, cycleId });
    return plan;
  }

  @Get('plans/:planId') @RequirePermissions('performance.read')
  async getPlan(@Param('planId') planId: string, @Req() request: { user: any }) {
    await this.access.requirePlanRead(planId, request.user);
    return this.service.getPlan(planId);
  }

  @Post('plans/:planId/items') @RequirePermissions('performance.manage')
  async addPlanItem(@Param('planId') planId: string, @Req() request: { user: any }, @Body() body: { type: 'KPI' | 'COMPETENCY'; kpiId?: string; competencyId?: string; description?: string; weight: number; target?: string }) {
    await this.access.requirePlanManagement(planId, request.user);
    return this.service.addPlanItem({ ...body, planId });
  }

  @Patch('plans/:planId/items/:itemId') @RequirePermissions('performance.manage')
  async updatePlanItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Req() request: { user: any },
    @Body() body: { description?: string; weight: number; target?: string },
  ) {
    await this.access.requirePlanManagement(planId, request.user);
    const item = await this.service.getPlan(planId);
    if (!item.items.some((planItem) => planItem.id === itemId)) throw new BadRequestException('Performance plan item does not belong to this plan');
    return this.service.updatePlanItem({ itemId, ...body });
  }

  @Delete('plans/:planId/items/:itemId') @RequirePermissions('performance.manage')
  async removePlanItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Req() request: { user: any },
  ) {
    await this.access.requirePlanManagement(planId, request.user);
    const plan = await this.service.getPlan(planId);
    if (!plan.items.some((item) => item.id === itemId)) throw new BadRequestException('Performance plan item does not belong to this plan');
    return this.service.removePlanItem(itemId);
  }

  @Post('plans/:planId/submit') @RequirePermissions('performance.manage')
  async submitPlan(@Param('planId') planId: string, @Req() request: { user: any }) {
    await this.access.requirePlanManagement(planId, request.user);
    const result = await this.service.submitPlan(planId);
    await this.audit.record('PERFORMANCE_PLAN_SUBMITTED', 'PerformancePlan', planId, request.user.id);
    return result;
  }

  @Post('plans/:planId/assessors') @RequirePermissions('performance.manage')
  async assignAssessors(
    @Param('planId') planId: string,
    @Req() request: { user: any },
    @Body() body: { reviewerId?: string | null; finalAssessorId?: string | null },
  ) {
    await this.access.requirePlanManagement(planId, request.user);
    const result = await this.assignments.assignAssessors(planId, body, request.user);
    await this.audit.record('PERFORMANCE_ASSESSORS_ASSIGNED', 'PerformancePlan', planId, request.user.id, {
      reviewerId: body.reviewerId ?? null,
      finalAssessorId: body.finalAssessorId ?? null,
    });
    return result;
  }

  @Post('plans/:planId/assessments') @RequirePermissions('performance.assess')
  async saveAssessment(@Param('planId') planId: string, @Req() request: { user: any }, @Body() body: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL'; comment?: string; items: Array<{ planItemId: string; ratingLevelId: string; comment?: string }> }) {
    await this.access.requirePlanOrganisationAccess(planId, request.user);
    await this.workflow.assertCanAssess(planId, body.assessorType);
    if (body.assessorType === 'REVIEWER' || body.assessorType === 'FINAL') {
      await this.assignments.assertAssigned(planId, body.assessorType, request.user.id);
    }
    return this.service.upsertAssessment(planId, request.user, body);
  }

  @Post('plans/:planId/assessments/submit') @RequirePermissions('performance.assess')
  async submitAssessment(@Param('planId') planId: string, @Req() request: { user: any }, @Body() body: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL' }) {
    await this.access.requirePlanOrganisationAccess(planId, request.user);
    await this.workflow.assertCanAssess(planId, body.assessorType);
    if (body.assessorType === 'REVIEWER' || body.assessorType === 'FINAL') {
      await this.assignments.assertAssigned(planId, body.assessorType, request.user.id);
    }
    const result = await this.service.submitAssessment(planId, request.user, body.assessorType);
    await this.audit.record('PERFORMANCE_ASSESSMENT_SUBMITTED', 'PerformancePlan', planId, request.user.id, { assessorType: body.assessorType });

    const plan = await this.service.getPlan(planId);
    let recipients: string[] = [];
    if (body.assessorType === 'SELF' && plan.employee.manager?.userId) {
      recipients = [plan.employee.manager.userId];
    } else if (body.assessorType === 'SUPERVISOR' && plan.reviewer?.user?.id) {
      recipients = [plan.reviewer.user.id];
    } else if (body.assessorType === 'REVIEWER' && plan.finalAssessor?.user?.id) {
      recipients = [plan.finalAssessor.user.id];
    } else if (body.assessorType === 'FINAL') {
      recipients = await this.prismaAdminRecipients(plan.cycle.organisationId);
    }
    const uniqueRecipients = [...new Set(recipients.filter((userId) => userId !== request.user.id))];
    await Promise.all(uniqueRecipients.map((userId) => this.notifications.notify(
      userId,
      body.assessorType === 'FINAL' ? 'Performance assessment ready for approval' : 'Performance assessment submitted',
      `${body.assessorType} assessment for ${plan.employee.user?.firstName ?? 'Employee'} ${plan.employee.user?.lastName ?? ''} has been submitted.`,
      `/performance/${planId}`,
    )));
    return result;
  }

  private async prismaAdminRecipients(organisationId: string | null) {
    if (!organisationId) return [];
    const employees = await this.prisma.employee.findMany({
      where: { organisationId, userId: { not: null }, user: { isActive: true } },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    return employees
      .filter(({ user }) => user !== null && user.roles.some(({ role }) => ['SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role.name)))
      .map(({ user }) => user.id);
  }

  @Post('plans/:planId/approve') @RequirePermissions('performance.approve')
  async approveFinalAssessment(@Param('planId') planId: string, @Req() request: { user: any }) {
    await this.access.requirePlanOrganisationAccess(planId, request.user);
    const result = await this.service.approveFinalAssessment(planId, request.user);
    await this.audit.record('PERFORMANCE_FINAL_APPROVED', 'PerformancePlan', planId, request.user.id);
    return result;
  }

  @Post('plans/:planId/lock') @RequirePermissions('performance.approve')
  async lockPlan(@Param('planId') planId: string, @Req() request: { user: any }) {
    await this.access.requirePlanOrganisationAccess(planId, request.user);
    const result = await this.service.lockPlan(planId, request.user);
    await this.audit.record('PERFORMANCE_PLAN_LOCKED', 'PerformancePlan', planId, request.user.id);
    return result;
  }
}

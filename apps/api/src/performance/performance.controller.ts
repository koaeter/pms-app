import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { RequirePermissions } from '../auth/permissions.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PerformanceAccessService } from './performance-access.service';
import { AssessmentWorkflowService } from './assessment-workflow.service';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(
    private readonly service: PerformanceService,
    private readonly access: PerformanceAccessService,
    private readonly audit: AuditService,
    private readonly workflow: AssessmentWorkflowService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('organisations/:organisationId/programmes') @RequirePermissions('performance.read')
  programmes(@Param('organisationId') organisationId: string) { return this.service.listProgrammes(organisationId); }
  @Post('organisations/:organisationId/programmes') @RequirePermissions('performance.manage')
  createProgramme(@Param('organisationId') organisationId: string, @Body() body: { name: string; code: string; description?: string }) { return this.service.createProgramme({ ...body, organisationId }); }
  @Get('programmes/:programmeId/review-types') @RequirePermissions('performance.read')
  reviewTypes(@Param('programmeId') programmeId: string) { return this.service.listReviewTypes(programmeId); }
  @Post('programmes/:programmeId/review-types') @RequirePermissions('performance.manage')
  createReviewType(@Param('programmeId') programmeId: string, @Body() body: { name: string; code: string; description?: string }) { return this.service.createReviewType({ ...body, programmeId }); }
  @Get('organisations/:organisationId/cycles') @RequirePermissions('performance.read')
  cycles(@Param('organisationId') organisationId: string) { return this.service.listCycles(organisationId); }
  @Post('organisations/:organisationId/cycles') @RequirePermissions('performance.manage')
  createCycle(@Param('organisationId') organisationId: string, @Body() body: { programmeId: string; reviewTypeId: string; name: string; startsAt: string; endsAt: string }) { return this.service.createCycle({ ...body, organisationId }); }
  @Get('programmes/:programmeId/kpis') @RequirePermissions('performance.read')
  kpis(@Param('programmeId') programmeId: string) { return this.service.listKpis(programmeId); }
  @Post('programmes/:programmeId/kpis') @RequirePermissions('performance.manage')
  createKpi(@Param('programmeId') programmeId: string, @Body() body: { name: string; code: string; description?: string; defaultWeight?: number }) { return this.service.createKpi({ ...body, programmeId }); }
  @Get('programmes/:programmeId/competencies') @RequirePermissions('performance.read')
  competencies(@Param('programmeId') programmeId: string) { return this.service.listCompetencies(programmeId); }
  @Post('programmes/:programmeId/competencies') @RequirePermissions('performance.manage')
  createCompetency(@Param('programmeId') programmeId: string, @Body() body: { name: string; code: string; description?: string; defaultWeight?: number }) { return this.service.createCompetency({ ...body, programmeId }); }
  @Get('organisations/:organisationId/rating-scales') @RequirePermissions('performance.read')
  ratingScales(@Param('organisationId') organisationId: string) { return this.service.listRatingScales(organisationId); }
  @Post('organisations/:organisationId/rating-scales') @RequirePermissions('performance.manage')
  createRatingScale(@Param('organisationId') organisationId: string, @Body() body: { name: string; description?: string; levels?: Array<{ name: string; score: number; description?: string }> }) { return this.service.createRatingScale({ ...body, organisationId }); }

  @Get('cycles/:cycleId/plans') @RequirePermissions('performance.read')
  async plans(@Param('cycleId') cycleId: string, @Req() request: { user: any }) {
    const plans = await this.service.listPlans(cycleId);
    return this.access.filterVisiblePlans(plans, request.user);
  }

  @Post('cycles/:cycleId/plans') @RequirePermissions('performance.manage')
  async createPlan(@Param('cycleId') cycleId: string, @Req() request: { user: any }, @Body() body: { employeeId: string; reviewTypeId: string }) {
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

  @Post('plans/:planId/submit') @RequirePermissions('performance.manage')
  async submitPlan(@Param('planId') planId: string, @Req() request: { user: any }) {
    await this.access.requirePlanManagement(planId, request.user);
    const result = await this.service.submitPlan(planId);
    await this.audit.record('PERFORMANCE_PLAN_SUBMITTED', 'PerformancePlan', planId, request.user.id);
    return result;
  }

  @Post('plans/:planId/assessments') @RequirePermissions('performance.assess')
  async saveAssessment(@Param('planId') planId: string, @Req() request: { user: any }, @Body() body: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL'; comment?: string; items: Array<{ planItemId: string; ratingLevelId: string; comment?: string }> }) {
    await this.workflow.assertCanAssess(planId, body.assessorType);
    return this.service.upsertAssessment(planId, request.user, body);
  }

  @Post('plans/:planId/assessments/submit') @RequirePermissions('performance.assess')
  async submitAssessment(@Param('planId') planId: string, @Req() request: { user: any }, @Body() body: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL' }) {
    await this.workflow.assertCanAssess(planId, body.assessorType);
    const result = await this.service.submitAssessment(planId, request.user, body.assessorType);
    await this.audit.record('PERFORMANCE_ASSESSMENT_SUBMITTED', 'PerformancePlan', planId, request.user.id, { assessorType: body.assessorType });

    const plan = await this.service.getPlan(planId);
    const recipients = body.assessorType === 'SELF' && plan.employee.manager
      ? [plan.employee.manager.userId]
      : body.assessorType === 'SUPERVISOR'
        ? [plan.employee.user.id]
        : [];
    await Promise.all(recipients.map((userId) => this.notifications.notify(
      userId,
      'Performance assessment submitted',
      `${body.assessorType} assessment for ${plan.employee.user.firstName} ${plan.employee.user.lastName} has been submitted.`,
      `/performance/${planId}`,
    )));
    return result;
  }

  @Post('plans/:planId/approve') @RequirePermissions('performance.approve')
  async approveFinalAssessment(@Param('planId') planId: string, @Req() request: { user: any }) {
    const result = await this.service.approveFinalAssessment(planId, request.user);
    await this.audit.record('PERFORMANCE_FINAL_APPROVED', 'PerformancePlan', planId, request.user.id);
    return result;
  }

  @Post('plans/:planId/lock') @RequirePermissions('performance.approve')
  async lockPlan(@Param('planId') planId: string, @Req() request: { user: any }) {
    const result = await this.service.lockPlan(planId, request.user);
    await this.audit.record('PERFORMANCE_PLAN_LOCKED', 'PerformancePlan', planId, request.user.id);
    return result;
  }
}

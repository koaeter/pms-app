import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('organisations/:organisationId/programmes')
  programmes(@Param('organisationId') organisationId: string) {
    return this.service.listProgrammes(organisationId);
  }

  @Post('organisations/:organisationId/programmes')
  createProgramme(@Param('organisationId') organisationId: string, @Body() body: { name: string; code: string; description?: string }) {
    return this.service.createProgramme({ ...body, organisationId });
  }

  @Get('programmes/:programmeId/review-types')
  reviewTypes(@Param('programmeId') programmeId: string) {
    return this.service.listReviewTypes(programmeId);
  }

  @Post('programmes/:programmeId/review-types')
  createReviewType(@Param('programmeId') programmeId: string, @Body() body: { name: string; code: string; description?: string }) {
    return this.service.createReviewType({ ...body, programmeId });
  }

  @Get('organisations/:organisationId/cycles')
  cycles(@Param('organisationId') organisationId: string) {
    return this.service.listCycles(organisationId);
  }

  @Post('organisations/:organisationId/cycles')
  createCycle(@Param('organisationId') organisationId: string, @Body() body: { programmeId: string; reviewTypeId: string; name: string; startsAt: string; endsAt: string }) {
    return this.service.createCycle({ ...body, organisationId });
  }

  @Get('programmes/:programmeId/kpis')
  kpis(@Param('programmeId') programmeId: string) {
    return this.service.listKpis(programmeId);
  }

  @Post('programmes/:programmeId/kpis')
  createKpi(@Param('programmeId') programmeId: string, @Body() body: { name: string; code: string; description?: string; defaultWeight?: number }) {
    return this.service.createKpi({ ...body, programmeId });
  }

  @Get('programmes/:programmeId/competencies')
  competencies(@Param('programmeId') programmeId: string) {
    return this.service.listCompetencies(programmeId);
  }

  @Post('programmes/:programmeId/competencies')
  createCompetency(@Param('programmeId') programmeId: string, @Body() body: { name: string; code: string; description?: string; defaultWeight?: number }) {
    return this.service.createCompetency({ ...body, programmeId });
  }

  @Get('organisations/:organisationId/rating-scales')
  ratingScales(@Param('organisationId') organisationId: string) {
    return this.service.listRatingScales(organisationId);
  }

  @Post('organisations/:organisationId/rating-scales')
  createRatingScale(@Param('organisationId') organisationId: string, @Body() body: { name: string; description?: string; levels?: Array<{ name: string; score: number; description?: string }> }) {
    return this.service.createRatingScale({ ...body, organisationId });
  }

  @Get('cycles/:cycleId/plans')
  plans(@Param('cycleId') cycleId: string) {
    return this.service.listPlans(cycleId);
  }

  @Post('cycles/:cycleId/plans')
  createPlan(@Param('cycleId') cycleId: string, @Body() body: { employeeId: string; reviewTypeId: string }) {
    return this.service.createPlan({ ...body, cycleId });
  }

  @Get('plans/:planId')
  getPlan(@Param('planId') planId: string) {
    return this.service.getPlan(planId);
  }

  @Post('plans/:planId/items')
  addPlanItem(@Param('planId') planId: string, @Body() body: { type: 'KPI' | 'COMPETENCY'; kpiId?: string; competencyId?: string; description?: string; weight: number; target?: string }) {
    return this.service.addPlanItem({ ...body, planId });
  }

  @Post('plans/:planId/submit')
  submitPlan(@Param('planId') planId: string) {
    return this.service.submitPlan(planId);
  }

  @Post('plans/:planId/assessments')
  saveAssessment(
    @Param('planId') planId: string,
    @Req() request: { user: { id: string; username: string; roles: string[]; permissions: string[] } },
    @Body() body: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL'; comment?: string; items: Array<{ planItemId: string; ratingLevelId: string; comment?: string }> },
  ) {
    return this.service.upsertAssessment(planId, request.user, body);
  }

  @Post('plans/:planId/assessments/submit')
  submitAssessment(
    @Param('planId') planId: string,
    @Req() request: { user: { id: string; username: string; roles: string[]; permissions: string[] } },
    @Body() body: { assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL' },
  ) {
    return this.service.submitAssessment(planId, request.user, body.assessorType);
  }

  @Post('plans/:planId/approve')
  approveFinalAssessment(
    @Param('planId') planId: string,
    @Req() request: { user: { id: string; username: string; roles: string[]; permissions: string[] } },
  ) {
    return this.service.approveFinalAssessment(planId, request.user);
  }

  @Post('plans/:planId/lock')
  lockPlan(
    @Param('planId') planId: string,
    @Req() request: { user: { id: string; username: string; roles: string[]; permissions: string[] } },
  ) {
    return this.service.lockPlan(planId, request.user);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionScope, WorkflowActionType } from '@prisma/client';
import { SessionGuard } from '../auth/guards/session.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { AuthRequest } from '../auth/types/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PerformanceService } from './performance.service';
import { EvidenceService } from './evidence.service';
import { WorkflowService } from './workflow.service';
import { ReviewAccessService } from './review-access.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateReviewTypeDto } from './dto/create-review-type.dto';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { CreateRatingScaleDto } from './dto/create-rating-scale.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateKpiScoreDto } from './dto/update-kpi-score.dto';
import { UpdateCompetencyRatingDto } from './dto/update-competency-rating.dto';
import { CalculateScoreDto } from './dto/calculate-score.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { WorkflowActionDto } from './dto/workflow-action.dto';

@Controller('performance')
@UseGuards(SessionGuard, PermissionGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService, private readonly evidence: EvidenceService, private readonly workflows: WorkflowService, private readonly reviewAccess: ReviewAccessService) {}

  @Get('programs')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listPrograms(@CurrentUser() user: AuthRequest['user']) { return this.performance.listPrograms(user.employee.organizationId); }

  @Post('programs')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createProgram(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateProgramDto) { return this.performance.createProgram(user.employee.organizationId, dto); }

  @Get('programs/:programId/cycles')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listCycles(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) { return this.performance.listCycles(user.employee.organizationId, programId); }

  @Post('programs/:programId/cycles')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createCycle(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string, @Body() dto: CreateCycleDto) { return this.performance.createCycle(user.employee.organizationId, programId, dto); }

  @Get('programs/:programId/review-types')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listReviewTypes(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) { return this.performance.listReviewTypes(user.employee.organizationId, programId); }

  @Post('programs/:programId/review-types')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createReviewType(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string, @Body() dto: CreateReviewTypeDto) { return this.performance.createReviewType(user.employee.organizationId, programId, dto); }

  @Get('kpis')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listKpis(@CurrentUser() user: AuthRequest['user']) { return this.performance.listKpis(user.employee.organizationId); }

  @Post('kpis')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createKpi(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateKpiDto) { return this.performance.createKpi(user.employee.organizationId, dto); }

  @Get('competencies')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listCompetencies(@CurrentUser() user: AuthRequest['user']) { return this.performance.listCompetencies(user.employee.organizationId); }

  @Post('competencies')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createCompetency(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateCompetencyDto) { return this.performance.createCompetency(user.employee.organizationId, dto); }

  @Get('rating-scales')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listRatingScales(@CurrentUser() user: AuthRequest['user']) { return this.performance.listRatingScales(user.employee.organizationId); }

  @Post('rating-scales')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createRatingScale(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateRatingScaleDto) { return this.performance.createRatingScale(user.employee.organizationId, dto); }

  @Get('reviews')
  @RequirePermission('performance.review.read', PermissionScope.ORGANIZATION)
  listReviews(@CurrentUser() user: AuthRequest['user'], @Query('employeeId') employeeId?: string, @Query('cycleId') cycleId?: string) { return this.performance.listReviews(user.employee.organizationId, employeeId, cycleId); }

  @Get('reviews/:reviewId')
  @RequirePermission('performance.review.read', PermissionScope.ORGANIZATION)
  getReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.performance.getReview(user.employee.organizationId, reviewId); }

  @Post('reviews')
  @RequirePermission('performance.review.create', PermissionScope.ORGANIZATION)
  createReview(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateReviewDto) { return this.performance.createReview(user.employee.organizationId, dto); }

  @Post('reviews/:reviewId/kpis/:kpiId/employee-score')
  @RequirePermission('performance.review.score.own', PermissionScope.OWN)
  async scoreKpiAsEmployee(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('kpiId') kpiId: string, @Body() dto: UpdateKpiScoreDto) { await this.reviewAccess.assertEmployee(user.employee.organizationId, reviewId, user.id); return this.performance.scoreKpi(user.employee.organizationId, reviewId, kpiId, dto, 'employee'); }

  @Post('reviews/:reviewId/kpis/:kpiId/supervisor-score')
  @RequirePermission('performance.review.score.direct_reports', PermissionScope.DIRECT_REPORTS)
  async scoreKpiAsSupervisor(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('kpiId') kpiId: string, @Body() dto: UpdateKpiScoreDto) { await this.reviewAccess.assertSupervisor(user.employee.organizationId, reviewId, user.id); return this.performance.scoreKpi(user.employee.organizationId, reviewId, kpiId, dto, 'supervisor'); }

  @Post('reviews/:reviewId/competencies/:competencyId/employee-rating')
  @RequirePermission('performance.review.score.own', PermissionScope.OWN)
  async rateCompetencyAsEmployee(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('competencyId') competencyId: string, @Body() dto: UpdateCompetencyRatingDto) { await this.reviewAccess.assertEmployee(user.employee.organizationId, reviewId, user.id); return this.performance.rateCompetency(user.employee.organizationId, reviewId, competencyId, dto, 'employee'); }

  @Post('reviews/:reviewId/competencies/:competencyId/supervisor-rating')
  @RequirePermission('performance.review.score.direct_reports', PermissionScope.DIRECT_REPORTS)
  async rateCompetencyAsSupervisor(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('competencyId') competencyId: string, @Body() dto: UpdateCompetencyRatingDto) { await this.reviewAccess.assertSupervisor(user.employee.organizationId, reviewId, user.id); return this.performance.rateCompetency(user.employee.organizationId, reviewId, competencyId, dto, 'supervisor'); }

  @Post('reviews/:reviewId/calculate-score')
  @RequirePermission('performance.review.workflow', PermissionScope.ORGANIZATION)
  calculateScore(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: CalculateScoreDto) { return this.performance.calculateScore(user.employee.organizationId, reviewId, dto); }

  @Get('reviews/:reviewId/evidence')
  @RequirePermission('performance.review.read', PermissionScope.ORGANIZATION)
  listEvidence(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.evidence.list(user.employee.organizationId, reviewId); }

  @Post('reviews/:reviewId/evidence')
  @RequirePermission('performance.review.score.own', PermissionScope.OWN)
  addEvidence(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: CreateEvidenceDto) { return this.evidence.create(user.employee.organizationId, reviewId, user.id, dto); }

  @Delete('evidence/:evidenceId')
  @RequirePermission('performance.review.score.own', PermissionScope.OWN)
  deleteEvidence(@CurrentUser() user: AuthRequest['user'], @Param('evidenceId') evidenceId: string) { return this.evidence.remove(user.employee.organizationId, evidenceId, user.id); }

  @Get('workflows')
  @RequirePermission('performance.config.read', PermissionScope.ORGANIZATION)
  listWorkflows(@CurrentUser() user: AuthRequest['user']) { return this.workflows.listWorkflows(user.employee.organizationId); }

  @Post('workflows')
  @RequirePermission('performance.config.write', PermissionScope.ORGANIZATION)
  createWorkflow(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateWorkflowDto) { return this.workflows.createWorkflow(user.employee.organizationId, dto); }

  @Get('reviews/:reviewId/workflow')
  @RequirePermission('performance.review.read', PermissionScope.ORGANIZATION)
  getReviewWorkflow(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.workflows.getReviewWorkflow(user.employee.organizationId, reviewId); }

  @Post('reviews/:reviewId/submit')
  @RequirePermission('performance.review.workflow', PermissionScope.OWN)
  submitReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.submit(user.employee.organizationId, reviewId, user.id, dto); }

  @Post('reviews/:reviewId/approve')
  @RequirePermission('performance.review.workflow', PermissionScope.DIRECT_REPORTS)
  approveReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, WorkflowActionType.APPROVE, dto); }

  @Post('reviews/:reviewId/return')
  @RequirePermission('performance.review.workflow', PermissionScope.DIRECT_REPORTS)
  returnReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, WorkflowActionType.RETURN, dto); }

  @Post('reviews/:reviewId/reject')
  @RequirePermission('performance.review.workflow', PermissionScope.DIRECT_REPORTS)
  rejectReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, WorkflowActionType.REJECT, dto); }

  @Post('reviews/:reviewId/delegate')
  @RequirePermission('performance.review.workflow', PermissionScope.DIRECT_REPORTS)
  delegateReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, WorkflowActionType.DELEGATE, dto); }

  @Post('reviews/:reviewId/cancel')
  @RequirePermission('performance.review.workflow', PermissionScope.ORGANIZATION)
  cancelReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, WorkflowActionType.CANCEL, dto); }
}

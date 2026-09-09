import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { AuthRequest } from '../auth/types/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PerformanceService } from './performance.service';
import { EvidenceService } from './evidence.service';
import { WorkflowService } from './workflow.service';
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
@UseGuards(SessionGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService, private readonly evidence: EvidenceService, private readonly workflows: WorkflowService) {}

  @Get('programs') listPrograms(@CurrentUser() user: AuthRequest['user']) { return this.performance.listPrograms(user.employee.organizationId); }
  @Post('programs') createProgram(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateProgramDto) { return this.performance.createProgram(user.employee.organizationId, dto); }
  @Get('programs/:programId/cycles') listCycles(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) { return this.performance.listCycles(user.employee.organizationId, programId); }
  @Post('programs/:programId/cycles') createCycle(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string, @Body() dto: CreateCycleDto) { return this.performance.createCycle(user.employee.organizationId, programId, dto); }
  @Get('programs/:programId/review-types') listReviewTypes(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) { return this.performance.listReviewTypes(user.employee.organizationId, programId); }
  @Post('programs/:programId/review-types') createReviewType(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string, @Body() dto: CreateReviewTypeDto) { return this.performance.createReviewType(user.employee.organizationId, programId, dto); }
  @Get('kpis') listKpis(@CurrentUser() user: AuthRequest['user']) { return this.performance.listKpis(user.employee.organizationId); }
  @Post('kpis') createKpi(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateKpiDto) { return this.performance.createKpi(user.employee.organizationId, dto); }
  @Get('competencies') listCompetencies(@CurrentUser() user: AuthRequest['user']) { return this.performance.listCompetencies(user.employee.organizationId); }
  @Post('competencies') createCompetency(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateCompetencyDto) { return this.performance.createCompetency(user.employee.organizationId, dto); }
  @Get('rating-scales') listRatingScales(@CurrentUser() user: AuthRequest['user']) { return this.performance.listRatingScales(user.employee.organizationId); }
  @Post('rating-scales') createRatingScale(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateRatingScaleDto) { return this.performance.createRatingScale(user.employee.organizationId, dto); }
  @Get('reviews') listReviews(@CurrentUser() user: AuthRequest['user'], @Query('employeeId') employeeId?: string, @Query('cycleId') cycleId?: string) { return this.performance.listReviews(user.employee.organizationId, employeeId, cycleId); }
  @Get('reviews/:reviewId') getReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.performance.getReview(user.employee.organizationId, reviewId); }
  @Post('reviews') createReview(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateReviewDto) { return this.performance.createReview(user.employee.organizationId, dto); }

  @Post('reviews/:reviewId/kpis/:kpiId/employee-score') scoreKpiAsEmployee(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('kpiId') kpiId: string, @Body() dto: UpdateKpiScoreDto) { return this.performance.scoreKpi(user.employee.organizationId, reviewId, kpiId, dto, 'employee'); }
  @Post('reviews/:reviewId/kpis/:kpiId/supervisor-score') scoreKpiAsSupervisor(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('kpiId') kpiId: string, @Body() dto: UpdateKpiScoreDto) { return this.performance.scoreKpi(user.employee.organizationId, reviewId, kpiId, dto, 'supervisor'); }
  @Post('reviews/:reviewId/competencies/:competencyId/employee-rating') rateCompetencyAsEmployee(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('competencyId') competencyId: string, @Body() dto: UpdateCompetencyRatingDto) { return this.performance.rateCompetency(user.employee.organizationId, reviewId, competencyId, dto, 'employee'); }
  @Post('reviews/:reviewId/competencies/:competencyId/supervisor-rating') rateCompetencyAsSupervisor(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Param('competencyId') competencyId: string, @Body() dto: UpdateCompetencyRatingDto) { return this.performance.rateCompetency(user.employee.organizationId, reviewId, competencyId, dto, 'supervisor'); }
  @Post('reviews/:reviewId/calculate-score') calculateScore(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: CalculateScoreDto) { return this.performance.calculateScore(user.employee.organizationId, reviewId, dto); }

  @Get('reviews/:reviewId/evidence') listEvidence(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.evidence.list(user.employee.organizationId, reviewId); }
  @Post('reviews/:reviewId/evidence') addEvidence(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: CreateEvidenceDto) { return this.evidence.create(user.employee.organizationId, reviewId, user.id, dto); }
  @Delete('evidence/:evidenceId') deleteEvidence(@CurrentUser() user: AuthRequest['user'], @Param('evidenceId') evidenceId: string) { return this.evidence.remove(user.employee.organizationId, evidenceId, user.id); }

  @Get('workflows') listWorkflows(@CurrentUser() user: AuthRequest['user']) { return this.workflows.listWorkflows(user.employee.organizationId); }
  @Post('workflows') createWorkflow(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateWorkflowDto) { return this.workflows.createWorkflow(user.employee.organizationId, dto); }
  @Get('reviews/:reviewId/workflow') getReviewWorkflow(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.workflows.getReviewWorkflow(user.employee.organizationId, reviewId); }
  @Post('reviews/:reviewId/submit') submitReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.submit(user.employee.organizationId, reviewId, user.id, dto); }
  @Post('reviews/:reviewId/approve') approveReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, 'APPROVE' as never, dto); }
  @Post('reviews/:reviewId/return') returnReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, 'RETURN' as never, dto); }
  @Post('reviews/:reviewId/reject') rejectReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, 'REJECT' as never, dto); }
  @Post('reviews/:reviewId/delegate') delegateReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, 'DELEGATE' as never, dto); }
  @Post('reviews/:reviewId/cancel') cancelReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string, @Body() dto: WorkflowActionDto) { return this.workflows.act(user.employee.organizationId, reviewId, user.id, 'CANCEL' as never, dto); }
}

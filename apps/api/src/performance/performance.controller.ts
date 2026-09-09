import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { AuthRequest } from '../auth/types/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PerformanceService } from './performance.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateReviewTypeDto } from './dto/create-review-type.dto';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { CreateRatingScaleDto } from './dto/create-rating-scale.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('performance')
@UseGuards(SessionGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get('programs')
  listPrograms(@CurrentUser() user: AuthRequest['user']) { return this.performance.listPrograms(user.employee.organizationId); }
  @Post('programs')
  createProgram(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateProgramDto) { return this.performance.createProgram(user.employee.organizationId, dto); }
  @Get('programs/:programId/cycles')
  listCycles(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) { return this.performance.listCycles(user.employee.organizationId, programId); }
  @Post('programs/:programId/cycles')
  createCycle(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string, @Body() dto: CreateCycleDto) { return this.performance.createCycle(user.employee.organizationId, programId, dto); }
  @Get('programs/:programId/review-types')
  listReviewTypes(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) { return this.performance.listReviewTypes(user.employee.organizationId, programId); }
  @Post('programs/:programId/review-types')
  createReviewType(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string, @Body() dto: CreateReviewTypeDto) { return this.performance.createReviewType(user.employee.organizationId, programId, dto); }
  @Get('kpis')
  listKpis(@CurrentUser() user: AuthRequest['user']) { return this.performance.listKpis(user.employee.organizationId); }
  @Post('kpis')
  createKpi(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateKpiDto) { return this.performance.createKpi(user.employee.organizationId, dto); }
  @Get('competencies')
  listCompetencies(@CurrentUser() user: AuthRequest['user']) { return this.performance.listCompetencies(user.employee.organizationId); }
  @Post('competencies')
  createCompetency(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateCompetencyDto) { return this.performance.createCompetency(user.employee.organizationId, dto); }
  @Get('rating-scales')
  listRatingScales(@CurrentUser() user: AuthRequest['user']) { return this.performance.listRatingScales(user.employee.organizationId); }
  @Post('rating-scales')
  createRatingScale(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateRatingScaleDto) { return this.performance.createRatingScale(user.employee.organizationId, dto); }

  @Get('reviews')
  listReviews(@CurrentUser() user: AuthRequest['user'], @Query('employeeId') employeeId?: string, @Query('cycleId') cycleId?: string) { return this.performance.listReviews(user.employee.organizationId, employeeId, cycleId); }

  @Get('reviews/:reviewId')
  getReview(@CurrentUser() user: AuthRequest['user'], @Param('reviewId') reviewId: string) { return this.performance.getReview(user.employee.organizationId, reviewId); }

  @Post('reviews')
  createReview(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateReviewDto) { return this.performance.createReview(user.employee.organizationId, dto); }
}

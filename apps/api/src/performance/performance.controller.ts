import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { AuthRequest } from '../auth/types/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PerformanceService } from './performance.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateReviewTypeDto } from './dto/create-review-type.dto';

@Controller('performance')
@UseGuards(SessionGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get('programs')
  listPrograms(@CurrentUser() user: AuthRequest['user']) {
    return this.performance.listPrograms(user.employee.organizationId);
  }

  @Post('programs')
  createProgram(@CurrentUser() user: AuthRequest['user'], @Body() dto: CreateProgramDto) {
    return this.performance.createProgram(user.employee.organizationId, dto);
  }

  @Get('programs/:programId/cycles')
  listCycles(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) {
    return this.performance.listCycles(user.employee.organizationId, programId);
  }

  @Post('programs/:programId/cycles')
  createCycle(
    @CurrentUser() user: AuthRequest['user'],
    @Param('programId') programId: string,
    @Body() dto: CreateCycleDto,
  ) {
    return this.performance.createCycle(user.employee.organizationId, programId, dto);
  }

  @Get('programs/:programId/review-types')
  listReviewTypes(@CurrentUser() user: AuthRequest['user'], @Param('programId') programId: string) {
    return this.performance.listReviewTypes(user.employee.organizationId, programId);
  }

  @Post('programs/:programId/review-types')
  createReviewType(
    @CurrentUser() user: AuthRequest['user'],
    @Param('programId') programId: string,
    @Body() dto: CreateReviewTypeDto,
  ) {
    return this.performance.createReviewType(user.employee.organizationId, programId, dto);
  }
}

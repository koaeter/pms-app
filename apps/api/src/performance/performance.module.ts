import { Module } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { PrismaService } from '../prisma.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceAccessService } from './performance-access.service';
import { CycleWorkflowController } from './cycle-workflow.controller';
import { CycleWorkflowService } from './cycle-workflow.service';
import { PerformanceDashboardController } from './performance-dashboard.controller';
import { PerformanceDashboardService } from './performance-dashboard.service';

@Module({
  controllers: [PerformanceController, CycleWorkflowController, PerformanceDashboardController],
  providers: [PerformanceService, PerformanceAccessService, CycleWorkflowService, PerformanceDashboardService, AuditService, PrismaService],
})
export class PerformanceModule {}

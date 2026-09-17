import { Module } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { PrismaService } from '../prisma.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceAccessService } from './performance-access.service';
import { CycleWorkflowController } from './cycle-workflow.controller';
import { CycleWorkflowService } from './cycle-workflow.service';

@Module({
  controllers: [PerformanceController, CycleWorkflowController],
  providers: [PerformanceService, PerformanceAccessService, CycleWorkflowService, AuditService, PrismaService],
})
export class PerformanceModule {}

import { Module } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceAccessService } from './performance-access.service';
import { CycleWorkflowController } from './cycle-workflow.controller';
import { CycleWorkflowService } from './cycle-workflow.service';
import { PerformanceDashboardController } from './performance-dashboard.controller';
import { PerformanceDashboardService } from './performance-dashboard.service';
import { AssessmentWorkflowService } from './assessment-workflow.service';
import { PerformanceAssignmentService } from './performance-assignment.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PerformanceController, CycleWorkflowController, PerformanceDashboardController],
  providers: [PerformanceService, PerformanceAccessService, CycleWorkflowService, PerformanceDashboardService, AssessmentWorkflowService, PerformanceAssignmentService, AuditService, PrismaService],
})
export class PerformanceModule {}

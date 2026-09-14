import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { EvidenceService } from './evidence.service';
import { WorkflowService } from './workflow.service';
import { ReviewAccessService } from './review-access.service';
import { ReviewLockService } from './review-lock.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService, EvidenceService, WorkflowService, ReviewAccessService, ReviewLockService],
})
export class PerformanceModule {}

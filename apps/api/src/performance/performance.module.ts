import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { EvidenceService } from './evidence.service';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService, EvidenceService, WorkflowService],
})
export class PerformanceModule {}

import { Module } from '@nestjs/common';
import { AuditService } from '../audit.service';
import { PrismaService } from '../prisma.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceAccessService } from './performance-access.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService, PerformanceAccessService, AuditService, PrismaService],
})
export class PerformanceModule {}

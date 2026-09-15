import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  controllers: [PerformanceController],
  providers: [PerformanceService, PrismaService],
})
export class PerformanceModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { OrganisationModule } from './organisation/organisation.module';
import { PerformanceModule } from './performance/performance.module';
import { SessionGuard } from './auth/session.guard';

@Module({
  imports: [AuthModule, OrganisationModule, PerformanceModule],
  controllers: [HealthController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [PrismaService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { OrganisationModule } from './organisation/organisation.module';
import { PerformanceModule } from './performance/performance.module';
import { AdminModule } from './admin/admin.module';
import { SessionGuard } from './auth/session.guard';
import { PermissionGuard } from './auth/permission.guard';

@Module({
  imports: [AuthModule, OrganisationModule, PerformanceModule, AdminModule],
  controllers: [HealthController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: SessionGuard }, { provide: APP_GUARD, useClass: PermissionGuard }],
  exports: [PrismaService],
})
export class AppModule {}

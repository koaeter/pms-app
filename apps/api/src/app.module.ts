import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { OrganizationModule } from './organization/organization.module';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { PerformanceModule } from './performance/performance.module';
import { ItAdminModule } from './it-admin/it-admin.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, EmployeesModule, OrganizationModule, PerformanceModule, ItAdminModule],
  controllers: [HealthController],
})
export class AppModule {}

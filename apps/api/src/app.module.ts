import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { OrganizationModule } from './organization/organization.module';
import { DatabaseModule } from './database/database.module';
import { PerformanceModule } from './performance/performance.module';

@Module({
  imports: [DatabaseModule, AuthModule, EmployeesModule, OrganizationModule, PerformanceModule],
  controllers: [HealthController],
})
export class AppModule {}

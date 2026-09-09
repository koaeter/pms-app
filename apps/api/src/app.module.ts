import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { OrganizationModule } from './organization/organization.module';

@Module({
  imports: [AuthModule, EmployeesModule, OrganizationModule],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}

import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('organisations/:organisationId/performance-summary')
  @RequirePermissions('reports.read')
  performanceSummary(@Param('organisationId') organisationId: string, @Req() request: { user: any }) {
    return this.service.performanceSummary(organisationId, request.user);
  }

  @Get('employees/:employeeId/performance-history')
  @RequirePermissions('reports.read')
  employeeHistory(@Param('employeeId') employeeId: string, @Req() request: { user: any }) {
    return this.service.employeeHistory(employeeId, request.user);
  }
}

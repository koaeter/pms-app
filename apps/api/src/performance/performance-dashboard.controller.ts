import { Controller, Get, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PerformanceDashboardService } from './performance-dashboard.service';

@Controller('performance/dashboard')
export class PerformanceDashboardController {
  constructor(private readonly service: PerformanceDashboardService) {}

  @Get('me')
  @RequirePermissions('performance.read')
  myPlans(@Req() request: { user: any }) {
    return this.service.myPlans(request.user);
  }

  @Get('team')
  @RequirePermissions('performance.read')
  myTeam(@Req() request: { user: any }) {
    return this.service.myTeam(request.user);
  }

  @Get('history')
  @RequirePermissions('performance.read')
  myHistory(@Req() request: { user: any }) {
    return this.service.myHistory(request.user);
  }
}

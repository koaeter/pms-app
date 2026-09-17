import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuditService } from '../audit.service';
import { CycleWorkflowService } from './cycle-workflow.service';
import { PerformanceAccessService } from './performance-access.service';

@Controller('performance/cycles')
export class CycleWorkflowController {
  constructor(private readonly service: CycleWorkflowService, private readonly access: PerformanceAccessService, private readonly audit: AuditService) {}

  @Post(':cycleId/status')
  @RequirePermissions('performance.manage')
  async updateStatus(
    @Param('cycleId') cycleId: string,
    @Req() request: { user: any },
    @Body() body: { status: 'DRAFT' | 'OPEN' | 'REVIEW' | 'CLOSED' },
  ) {
    await this.access.requireCycleAccess(cycleId, request.user);
    const cycle = await this.service.updateStatus(cycleId, body.status);
    await this.audit.record('PERFORMANCE_CYCLE_STATUS_CHANGED', 'PerformanceCycle', cycleId, request.user.id, { status: body.status });
    return cycle;
  }
}

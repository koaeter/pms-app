import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AuditService } from '../audit.service';
import { CycleWorkflowService } from './cycle-workflow.service';

@Controller('performance/cycles')
export class CycleWorkflowController {
  constructor(private readonly service: CycleWorkflowService, private readonly audit: AuditService) {}

  @Post(':cycleId/status')
  @RequirePermissions('performance.manage')
  async updateStatus(
    @Param('cycleId') cycleId: string,
    @Req() request: { user: { id: string } },
    @Body() body: { status: 'DRAFT' | 'OPEN' | 'REVIEW' | 'CLOSED' },
  ) {
    const cycle = await this.service.updateStatus(cycleId, body.status);
    await this.audit.record('PERFORMANCE_CYCLE_STATUS_CHANGED', 'PerformanceCycle', cycleId, request.user.id, { status: body.status });
    return cycle;
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AssessmentWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAssess(planId: string, assessorType: 'SELF' | 'SUPERVISOR' | 'REVIEWER' | 'FINAL') {
    const plan = await this.prisma.performancePlan.findUnique({
      where: { id: planId },
      include: { cycle: true, assessments: true },
    });
    if (!plan) throw new BadRequestException('Performance plan not found');
    if (plan.cycle.status === 'CLOSED') throw new BadRequestException('This performance cycle is closed');
    if (plan.status === 'APPROVED' || plan.status === 'LOCKED') throw new BadRequestException('This performance plan is already finalised');

    const submitted = (type: string) => plan.assessments.some((a) => a.assessorType === type && a.status !== 'DRAFT');

    if (assessorType === 'SELF') {
      if (plan.status !== 'SUBMITTED' && plan.status !== 'IN_REVIEW') {
        throw new BadRequestException('The performance plan must be submitted before self assessment');
      }
      if (submitted('SELF')) throw new BadRequestException('Self assessment has already been submitted');
    }
    if (assessorType === 'SUPERVISOR' && !submitted('SELF')) throw new BadRequestException('Employee self assessment must be submitted first');
    if (assessorType === 'REVIEWER' && !submitted('SUPERVISOR')) throw new BadRequestException('Supervisor assessment must be submitted first');
    if (assessorType === 'FINAL' && !submitted('REVIEWER')) throw new BadRequestException('Reviewer assessment must be submitted first');

    return plan;
  }
}

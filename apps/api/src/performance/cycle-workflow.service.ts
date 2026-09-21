import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const transitions: Record<string, string[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['REVIEW', 'CLOSED'],
  REVIEW: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

@Injectable()
export class CycleWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async updateStatus(cycleId: string, status: 'DRAFT' | 'OPEN' | 'REVIEW' | 'CLOSED') {
    const cycle = await this.prisma.performanceCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    if (cycle.status === status) return cycle;
    if (!transitions[cycle.status]?.includes(status)) {
      throw new BadRequestException(`Invalid cycle transition from ${cycle.status} to ${status}`);
    }

    if (status === 'OPEN') {
      if (cycle.endsAt <= cycle.startsAt) throw new BadRequestException('Cycle end date must be after the start date');
      const programme = await this.prisma.performanceProgramme.findUnique({ where: { id: cycle.programmeId } });
      if (!programme?.isActive) throw new BadRequestException('The cycle programme must be active before opening the cycle');
      if (!cycle.ratingScaleId) throw new BadRequestException('A rating scale must be configured before opening the performance cycle');
      const ratingScale = await this.prisma.ratingScale.findUnique({ where: { id: cycle.ratingScaleId } });
      if (!ratingScale || ratingScale.organisationId !== cycle.organisationId) {
        throw new BadRequestException('The cycle rating scale must belong to the cycle organisation');
      }
      const levelCount = await this.prisma.ratingLevel.count({ where: { scaleId: cycle.ratingScaleId } });
      if (levelCount === 0) throw new BadRequestException('The cycle rating scale must contain at least one rating level');
    }

    if (status === 'REVIEW') {
      const submittedPlans = await this.prisma.performancePlan.count({ where: { cycleId, status: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'LOCKED'] } } });
      const totalPlans = await this.prisma.performancePlan.count({ where: { cycleId } });
      if (totalPlans > 0 && submittedPlans < totalPlans) {
        throw new BadRequestException('All performance plans must be submitted or already in review before the cycle enters review');
      }
    }

    return this.prisma.performanceCycle.update({ where: { id: cycleId }, data: { status } });
  }
}

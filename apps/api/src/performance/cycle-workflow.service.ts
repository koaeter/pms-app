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
    return this.prisma.$transaction(async (tx: any) => {
      // Re-read the cycle inside the transaction so validation and the state change
      // operate on the same database snapshot.
      const cycle = await tx.performanceCycle.findUnique({ where: { id: cycleId } });
      if (!cycle) throw new NotFoundException('Performance cycle not found');
      if (cycle.status === status) return cycle;
      if (!transitions[cycle.status]?.includes(status)) {
        throw new BadRequestException(`Invalid cycle transition from ${cycle.status} to ${status}`);
      }

      if (status === 'OPEN') {
        if (cycle.endsAt <= cycle.startsAt) throw new BadRequestException('Cycle end date must be after the start date');
        const programme = await tx.performanceProgramme.findUnique({ where: { id: cycle.programmeId } });
        if (!programme?.isActive) throw new BadRequestException('The cycle programme must be active before opening the cycle');
        if (!cycle.ratingScaleId) throw new BadRequestException('A rating scale must be configured before opening the performance cycle');
        const ratingScale = await tx.ratingScale.findUnique({ where: { id: cycle.ratingScaleId } });
        if (!ratingScale || ratingScale.organisationId !== cycle.organisationId) {
          throw new BadRequestException('The cycle rating scale must belong to the cycle organisation');
        }
        const levelCount = await tx.ratingLevel.count({ where: { scaleId: cycle.ratingScaleId } });
        if (levelCount === 0) throw new BadRequestException('The cycle rating scale must contain at least one rating level');
      }

      if (status === 'REVIEW') {
        const submittedPlans = await tx.performancePlan.count({ where: { cycleId, status: { in: ['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'LOCKED'] } } });
        const totalPlans = await tx.performancePlan.count({ where: { cycleId } });
        if (totalPlans > 0 && submittedPlans < totalPlans) {
          throw new BadRequestException('All performance plans must be submitted or already in review before the cycle enters review');
        }
      }

      // Conditional update prevents two concurrent requests from both applying
      // transitions based on the same previous status.
      const result = await tx.performanceCycle.updateMany({
        where: { id: cycleId, status: cycle.status },
        data: { status },
      });
      if (result.count !== 1) {
        throw new BadRequestException('The performance cycle changed before this transition could be applied');
      }

      return tx.performanceCycle.findUnique({ where: { id: cycleId } });
    });
  }
}

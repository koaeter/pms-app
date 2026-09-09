import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReviewAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertEmployee(organizationId: string, reviewId: string, userId: string) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { id: reviewId, employee: { organizationId } },
      select: { employeeId: true },
    });
    if (!review) throw new NotFoundException('Performance review not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user || user.employeeId !== review.employeeId) throw new ForbiddenException('Only the review employee may perform this action');
  }

  async assertSupervisor(organizationId: string, reviewId: string, userId: string) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { id: reviewId, employee: { organizationId } },
      select: { supervisorEmployeeIdSnapshot: true },
    });
    if (!review) throw new NotFoundException('Performance review not found');
    if (!review.supervisorEmployeeIdSnapshot) throw new ForbiddenException('This review has no assigned supervisor');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user || user.employeeId !== review.supervisorEmployeeIdSnapshot) throw new ForbiddenException('Only the assigned supervisor may perform this action');
  }
}

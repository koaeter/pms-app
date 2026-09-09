import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, reviewId: string) {
    await this.requireReview(organizationId, reviewId);
    const items = await this.prisma.evidence.findMany({ where: { performanceReviewId: reviewId }, orderBy: { createdAt: 'desc' } });
    return items.map((item) => ({ ...item, fileSize: item.fileSize === null ? null : Number(item.fileSize) }));
  }

  async create(organizationId: string, reviewId: string, userId: string, dto: CreateEvidenceDto) {
    const review = await this.requireReview(organizationId, reviewId);
    if (['FINALIZED', 'LOCKED', 'CANCELLED'].includes(review.status)) throw new ConflictException('Evidence cannot be added to this review');
    if (dto.performanceKpiId && dto.performanceCompetencyId) throw new ConflictException('Evidence can target a KPI or competency, not both');
    if (dto.performanceKpiId) {
      const kpi = await this.prisma.performanceKpi.findFirst({ where: { id: dto.performanceKpiId, performanceReviewId: reviewId } });
      if (!kpi) throw new NotFoundException('Performance KPI not found in this review');
    }
    if (dto.performanceCompetencyId) {
      const competency = await this.prisma.performanceCompetency.findFirst({ where: { id: dto.performanceCompetencyId, performanceReviewId: reviewId } });
      if (!competency) throw new NotFoundException('Performance competency not found in this review');
    }
    const evidence = await this.prisma.evidence.create({ data: { performanceReviewId: reviewId, performanceKpiId: dto.performanceKpiId ?? null, performanceCompetencyId: dto.performanceCompetencyId ?? null, uploadedBy: userId, fileName: dto.fileName.trim(), storageKey: dto.storageKey.trim(), mimeType: dto.mimeType?.trim() || null, fileSize: dto.fileSize ?? null, checksum: dto.checksum?.trim() || null, description: dto.description?.trim() || null } });
    return { ...evidence, fileSize: evidence.fileSize === null ? null : Number(evidence.fileSize) };
  }

  async remove(organizationId: string, evidenceId: string, userId: string) {
    const evidence = await this.prisma.evidence.findFirst({ where: { id: evidenceId, performanceReview: { employee: { organizationId } } } });
    if (!evidence) throw new NotFoundException('Evidence not found');
    if (evidence.uploadedBy !== userId) throw new ForbiddenException('Only the uploader can remove this evidence');
    await this.prisma.evidence.delete({ where: { id: evidence.id } });
    return { deleted: true, id: evidence.id };
  }

  private async requireReview(organizationId: string, reviewId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } } });
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }
}

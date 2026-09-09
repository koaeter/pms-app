import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateReviewTypeDto } from './dto/create-review-type.dto';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { CreateRatingScaleDto } from './dto/create-rating-scale.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateKpiScoreDto } from './dto/update-kpi-score.dto';
import { UpdateCompetencyRatingDto } from './dto/update-competency-rating.dto';
import { CalculateScoreDto } from './dto/calculate-score.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  listPrograms(organizationId: string) {
    return this.prisma.performanceProgram.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' }, include: { _count: { select: { cycles: true, reviewTypes: true } } } });
  }

  async createProgram(organizationId: string, dto: CreateProgramDto) {
    try { return await this.prisma.performanceProgram.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Performance program code already exists'); throw error; }
  }

  async listCycles(organizationId: string, programId: string) {
    await this.requireProgram(organizationId, programId);
    return this.prisma.performanceCycle.findMany({ where: { programId }, orderBy: { startDate: 'desc' } });
  }

  async createCycle(organizationId: string, programId: string, dto: CreateCycleDto) {
    await this.requireProgram(organizationId, programId);
    const startDate = new Date(dto.startDate); const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new ConflictException('Cycle end date must be after cycle start date');
    try { return await this.prisma.performanceCycle.create({ data: { programId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), year: dto.year, startDate, endDate } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Performance cycle code already exists'); throw error; }
  }

  async listReviewTypes(organizationId: string, programId: string) {
    await this.requireProgram(organizationId, programId);
    return this.prisma.performanceReviewType.findMany({ where: { programId, active: true }, orderBy: { name: 'asc' } });
  }

  async createReviewType(organizationId: string, programId: string, dto: CreateReviewTypeDto) {
    await this.requireProgram(organizationId, programId);
    try { return await this.prisma.performanceReviewType.create({ data: { programId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Review type code already exists'); throw error; }
  }

  listKpis(organizationId: string) { return this.prisma.kpi.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } }); }
  async createKpi(organizationId: string, dto: CreateKpiDto) {
    try { return await this.prisma.kpi.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, measurementMethod: dto.measurementMethod?.trim() || null, defaultUnit: dto.defaultUnit?.trim() || null } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('KPI code already exists'); throw error; }
  }

  listCompetencies(organizationId: string) { return this.prisma.competency.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } }); }
  async createCompetency(organizationId: string, dto: CreateCompetencyDto) {
    try { return await this.prisma.competency.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Competency code already exists'); throw error; }
  }

  listRatingScales(organizationId: string) { return this.prisma.ratingScale.findMany({ where: { organizationId, active: true }, include: { items: { orderBy: { value: 'asc' } } }, orderBy: { name: 'asc' } }); }
  async createRatingScale(organizationId: string, dto: CreateRatingScaleDto) {
    if (!dto.items?.length) throw new ConflictException('A rating scale must contain at least one item');
    const values = dto.items.map((item) => item.value);
    if (new Set(values).size !== values.length) throw new ConflictException('Rating scale values must be unique');
    try { return await this.prisma.ratingScale.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, items: { create: dto.items.map((item) => ({ value: item.value, label: item.label.trim(), description: item.description?.trim() || null, minScore: item.minScore, maxScore: item.maxScore })) } }, include: { items: { orderBy: { value: 'asc' } } } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Rating scale code or value already exists'); throw error; }
  }

  async listReviews(organizationId: string, employeeId?: string, cycleId?: string) {
    return this.prisma.performanceReview.findMany({ where: { employee: { organizationId }, ...(employeeId ? { employeeId } : {}), ...(cycleId ? { performanceCycleId: cycleId } : {}) }, orderBy: { createdAt: 'desc' }, include: { employee: true, performanceCycle: { include: { program: true } }, reviewType: true, kpis: true, competencies: { include: { competency: true } }, scores: { orderBy: { calculatedAt: 'desc' }, take: 1 } } });
  }

  async getReview(organizationId: string, reviewId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } }, include: { employee: true, performanceCycle: { include: { program: true } }, reviewType: true, kpis: { include: { kpi: true } }, competencies: { include: { competency: true } }, scores: { orderBy: { calculatedAt: 'desc' } }, evidence: true, workflowInstance: true } });
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }

  async createReview(organizationId: string, dto: CreateReviewDto) {
    const [employee, cycle, reviewType] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, organizationId, active: true } }),
      this.prisma.performanceCycle.findFirst({ where: { id: dto.performanceCycleId, program: { organizationId }, status: { in: ['DRAFT', 'OPEN'] } }, include: { program: true } }),
      this.prisma.performanceReviewType.findFirst({ where: { id: dto.reviewTypeId, active: true, program: { organizationId } } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found');
    if (!cycle) throw new NotFoundException('Performance cycle not found or is not available');
    if (!reviewType) throw new NotFoundException('Performance review type not found');
    if (cycle.programId !== reviewType.programId) throw new ConflictException('Review type and cycle must belong to the same program');
    const assignment = await this.prisma.employeeOrganizationalUnit.findFirst({ where: { employeeId: employee.id, isPrimary: true, endDate: null }, include: { organizationalUnit: true, designation: true, supervisor: true } });
    const kpiIds = dto.kpis?.map((item) => item.kpiId) ?? []; const competencyIds = dto.competencies?.map((item) => item.competencyId) ?? [];
    if (new Set(kpiIds).size !== kpiIds.length) throw new ConflictException('A KPI cannot be assigned more than once to a review');
    if (new Set(competencyIds).size !== competencyIds.length) throw new ConflictException('A competency cannot be assigned more than once to a review');
    const [kpis, competencies] = await Promise.all([this.prisma.kpi.findMany({ where: { id: { in: kpiIds }, organizationId, active: true } }), this.prisma.competency.findMany({ where: { id: { in: competencyIds }, organizationId, active: true } })]);
    if (kpis.length !== kpiIds.length) throw new NotFoundException('One or more KPIs were not found in the employee organization');
    if (competencies.length !== competencyIds.length) throw new NotFoundException('One or more competencies were not found in the employee organization');
    try {
      return await this.prisma.performanceReview.create({ data: { employeeId: employee.id, performanceCycleId: cycle.id, reviewTypeId: reviewType.id, organizationUnitIdSnapshot: assignment?.organizationalUnitId ?? null, designationIdSnapshot: assignment?.designationId ?? employee.designationId ?? null, supervisorEmployeeIdSnapshot: assignment?.supervisorEmployeeId ?? null, organizationUnitNameSnapshot: assignment?.organizationalUnit.name ?? null, designationNameSnapshot: assignment?.designation?.name ?? null, supervisorNameSnapshot: assignment?.supervisor ? `${assignment.supervisor.firstName} ${assignment.supervisor.lastName}` : null, startedAt: new Date(), kpis: { create: (dto.kpis ?? []).map((item) => { const kpi = kpis.find((entry) => entry.id === item.kpiId)!; return { kpiId: kpi.id, employeeId: employee.id, title: item.title?.trim() || kpi.name, description: item.description?.trim() || kpi.description, target: item.target?.trim() || null, measurementUnit: item.measurementUnit?.trim() || kpi.defaultUnit, weight: item.weight }; }) }, competencies: { create: (dto.competencies ?? []).map((item) => ({ competencyId: item.competencyId, weight: item.weight })) } }, include: { employee: true, performanceCycle: true, reviewType: true, kpis: { include: { kpi: true } }, competencies: { include: { competency: true } } } });
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('A review already exists for this employee, cycle and review type'); throw error; }
  }

  async scoreKpi(organizationId: string, reviewId: string, kpiId: string, dto: UpdateKpiScoreDto, actor: 'employee' | 'supervisor') {
    const review = await this.requireReview(organizationId, reviewId);
    if (['FINALIZED', 'LOCKED', 'CANCELLED'].includes(review.status)) throw new ConflictException('This review can no longer be scored');
    const kpi = await this.prisma.performanceKpi.findFirst({ where: { id: kpiId, performanceReviewId: review.id } });
    if (!kpi) throw new NotFoundException('Performance KPI not found');
    return this.prisma.performanceKpi.update({ where: { id: kpi.id }, data: actor === 'employee' ? { employeeScore: dto.score, actualResult: dto.actualResult?.trim(), employeeComment: dto.comment?.trim() } : { supervisorScore: dto.score, actualResult: dto.actualResult?.trim(), supervisorComment: dto.comment?.trim() } });
  }

  async rateCompetency(organizationId: string, reviewId: string, competencyId: string, dto: UpdateCompetencyRatingDto, actor: 'employee' | 'supervisor') {
    const review = await this.requireReview(organizationId, reviewId);
    if (['FINALIZED', 'LOCKED', 'CANCELLED'].includes(review.status)) throw new ConflictException('This review can no longer be rated');
    const competency = await this.prisma.performanceCompetency.findFirst({ where: { id: competencyId, performanceReviewId: review.id } });
    if (!competency) throw new NotFoundException('Performance competency not found');
    return this.prisma.performanceCompetency.update({ where: { id: competency.id }, data: actor === 'employee' ? { employeeRating: dto.rating, employeeComment: dto.comment?.trim() } : { supervisorRating: dto.rating, supervisorComment: dto.comment?.trim() } });
  }

  async calculateScore(organizationId: string, reviewId: string, dto: CalculateScoreDto) {
    await this.requireReview(organizationId, reviewId);
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId }, include: { kpis: true, competencies: true } });
    if (!review) throw new NotFoundException('Performance review not found');
    if (['CANCELLED'].includes(review.status)) throw new ConflictException('Cancelled reviews cannot be scored');
    const kpiWeighted = review.kpis.filter((k) => k.supervisorScore !== null || k.employeeScore !== null);
    const competencyWeighted = review.competencies.filter((c) => c.supervisorRating !== null || c.employeeRating !== null);
    const kpiWeight = kpiWeighted.reduce((sum, k) => sum + Number(k.weight), 0);
    const competencyWeight = competencyWeighted.reduce((sum, c) => sum + Number(c.weight), 0);
    const kpiScore = kpiWeight ? kpiWeighted.reduce((sum, k) => sum + Number(k.supervisorScore ?? k.employeeScore) * Number(k.weight), 0) / kpiWeight : null;
    const competencyScore = competencyWeight ? competencyWeighted.reduce((sum, c) => sum + Number(c.supervisorRating ?? c.employeeRating) * Number(c.weight), 0) / competencyWeight : null;
    const totalWeight = kpiWeight + competencyWeight;
    const overallScore = totalWeight ? ((kpiScore ?? 0) * kpiWeight + (competencyScore ?? 0) * competencyWeight) / totalWeight : null;
    let overallRating: string | null = null;
    if (overallScore !== null && dto.ratingScaleId) {
      const scale = await this.prisma.ratingScale.findFirst({ where: { id: dto.ratingScaleId, organizationId, active: true }, include: { items: { orderBy: { minScore: 'desc' } } } });
      if (!scale) throw new NotFoundException('Rating scale not found');
      const item = scale.items.find((entry) => entry.minScore !== null && overallScore >= Number(entry.minScore) && (entry.maxScore === null || overallScore <= Number(entry.maxScore)));
      overallRating = item?.label ?? null;
    }
    return this.prisma.performanceScore.create({ data: { performanceReviewId: reviewId, ratingScaleId: dto.ratingScaleId ?? null, kpiScore, competencyScore, overallScore, overallRating } });
  }

  private async requireReview(organizationId: string, reviewId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } } });
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }

  private async requireProgram(organizationId: string, programId: string) {
    const program = await this.prisma.performanceProgram.findFirst({ where: { id: programId, organizationId, active: true } });
    if (!program) throw new NotFoundException('Performance program not found');
    return program;
  }
}

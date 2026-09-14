import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';
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
  constructor(private readonly prisma: PrismaService, private readonly audit?: AuditService) {}

  listPrograms(organizationId: string) {
    return this.prisma.performanceProgram.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' }, include: { _count: { select: { cycles: true, reviewTypes: true } } } });
  }

  async createProgram(organizationId: string, dto: CreateProgramDto) {
    try {
      const program = await this.prisma.performanceProgram.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } });
      await this.audit?.record({ action: 'PERFORMANCE_PROGRAM_CREATED', module: 'performance', entityType: 'PerformanceProgram', entityId: program.id, newValues: { name: program.name, code: program.code } });
      return program;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Performance program code already exists'); throw error; }
  }

  async listCycles(organizationId: string, programId: string) { await this.requireProgram(organizationId, programId); return this.prisma.performanceCycle.findMany({ where: { programId }, orderBy: { startDate: 'desc' } }); }

  async createCycle(organizationId: string, programId: string, dto: CreateCycleDto) {
    await this.requireProgram(organizationId, programId);
    const startDate = new Date(dto.startDate); const endDate = new Date(dto.endDate);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) throw new ConflictException('Cycle dates must be valid dates');
    if (endDate <= startDate) throw new ConflictException('Cycle end date must be after cycle start date');
    try {
      const cycle = await this.prisma.performanceCycle.create({ data: { programId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), year: dto.year, startDate, endDate } });
      await this.audit?.record({ action: 'PERFORMANCE_CYCLE_CREATED', module: 'performance', entityType: 'PerformanceCycle', entityId: cycle.id, newValues: { name: cycle.name, code: cycle.code, startDate: cycle.startDate, endDate: cycle.endDate } });
      return cycle;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Performance cycle code already exists'); throw error; }
  }

  async listReviewTypes(organizationId: string, programId: string) { await this.requireProgram(organizationId, programId); return this.prisma.performanceReviewType.findMany({ where: { programId, active: true }, orderBy: { name: 'asc' } }); }

  async createReviewType(organizationId: string, programId: string, dto: CreateReviewTypeDto) {
    await this.requireProgram(organizationId, programId);
    try {
      const reviewType = await this.prisma.performanceReviewType.create({ data: { programId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } });
      await this.audit?.record({ action: 'PERFORMANCE_REVIEW_TYPE_CREATED', module: 'performance', entityType: 'PerformanceReviewType', entityId: reviewType.id, newValues: { name: reviewType.name, code: reviewType.code } });
      return reviewType;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Review type code already exists'); throw error; }
  }

  listKpis(organizationId: string) { return this.prisma.kpi.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } }); }

  async createKpi(organizationId: string, dto: CreateKpiDto) {
    try {
      const kpi = await this.prisma.kpi.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, measurementMethod: dto.measurementMethod?.trim() || null, defaultUnit: dto.defaultUnit?.trim() || null } });
      await this.audit?.record({ action: 'KPI_CREATED', module: 'performance', entityType: 'Kpi', entityId: kpi.id, newValues: { name: kpi.name, code: kpi.code } });
      return kpi;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('KPI code already exists'); throw error; }
  }

  listCompetencies(organizationId: string) { return this.prisma.competency.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } }); }

  async createCompetency(organizationId: string, dto: CreateCompetencyDto) {
    try {
      const competency = await this.prisma.competency.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } });
      await this.audit?.record({ action: 'COMPETENCY_CREATED', module: 'performance', entityType: 'Competency', entityId: competency.id, newValues: { name: competency.name, code: competency.code } });
      return competency;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Competency code already exists'); throw error; }
  }

  listRatingScales(organizationId: string) { return this.prisma.ratingScale.findMany({ where: { organizationId, active: true }, include: { items: { orderBy: { value: 'asc' } } }, orderBy: { name: 'asc' } }); }

  async createRatingScale(organizationId: string, dto: CreateRatingScaleDto) {
    if (!dto.items?.length) throw new ConflictException('A rating scale must contain at least one item');
    const values = dto.items.map((item) => item.value);
    if (new Set(values).size !== values.length) throw new ConflictException('Rating scale values must be unique');
    for (const item of dto.items) {
      if (!Number.isFinite(item.value)) throw new ConflictException('Rating scale values must be finite numbers');
      if (item.minScore !== null && item.minScore !== undefined && !Number.isFinite(item.minScore)) throw new ConflictException('Rating scale minimum scores must be finite numbers');
      if (item.maxScore !== null && item.maxScore !== undefined && !Number.isFinite(item.maxScore)) throw new ConflictException('Rating scale maximum scores must be finite numbers');
      if (item.minScore !== null && item.minScore !== undefined && item.maxScore !== null && item.maxScore !== undefined && item.maxScore < item.minScore) throw new ConflictException('Rating scale maximum score cannot be below its minimum score');
    }
    try {
      const scale = await this.prisma.ratingScale.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, items: { create: dto.items.map((item) => ({ value: item.value, label: item.label.trim(), description: item.description?.trim() || null, minScore: item.minScore, maxScore: item.maxScore })) } }, include: { items: { orderBy: { value: 'asc' } } } });
      await this.audit?.record({ action: 'RATING_SCALE_CREATED', module: 'performance', entityType: 'RatingScale', entityId: scale.id, newValues: { name: scale.name, code: scale.code, itemCount: scale.items.length } });
      return scale;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Rating scale code or value already exists'); throw error; }
  }

  private reviewInclude() { return { employee: true, performanceCycle: { include: { program: true } }, reviewType: true, kpis: { include: { kpi: true } }, competencies: { include: { competency: true } }, scores: { orderBy: { calculatedAt: 'desc' as const }, take: 1 } }; }

  async listReviews(organizationId: string, employeeId?: string, cycleId?: string) { return this.prisma.performanceReview.findMany({ where: { employee: { organizationId }, ...(employeeId ? { employeeId } : {}), ...(cycleId ? { performanceCycleId: cycleId } : {}) }, orderBy: { createdAt: 'desc' }, include: this.reviewInclude() }); }
  async listMyReviews(organizationId: string, employeeId: string) { return this.listReviews(organizationId, employeeId); }

  async listTeamReviews(organizationId: string, supervisorEmployeeId: string, isHod: boolean) {
    if (!isHod) return this.prisma.performanceReview.findMany({ where: { employee: { organizationId }, supervisorEmployeeIdSnapshot: supervisorEmployeeId }, orderBy: { createdAt: 'desc' }, include: this.reviewInclude() });
    const assignments = await this.prisma.employeeOrganizationalUnit.findMany({ where: { supervisorEmployeeId, isPrimary: true, endDate: null }, select: { organizationalUnitId: true } });
    const unitIds = new Set(assignments.map((a) => a.organizationalUnitId)); if (!unitIds.size) return [];
    const units = await this.prisma.organizationalUnit.findMany({ where: { organizationId, active: true }, select: { id: true, parentId: true } });
    let changed = true; while (changed) { changed = false; for (const unit of units) { if (unit.parentId && unitIds.has(unit.parentId) && !unitIds.has(unit.id)) { unitIds.add(unit.id); changed = true; } } }
    return this.prisma.performanceReview.findMany({ where: { employee: { organizationId, assignments: { some: { organizationalUnitId: { in: [...unitIds] }, isPrimary: true, endDate: null } } } }, orderBy: { createdAt: 'desc' }, include: this.reviewInclude() });
  }

  async getReview(organizationId: string, reviewId: string) {
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } }, include: { employee: true, performanceCycle: { include: { program: true } }, reviewType: true, kpis: { include: { kpi: true } }, competencies: { include: { competency: true } }, scores: { orderBy: { calculatedAt: 'desc' } }, evidence: true, workflowInstance: true } });
    if (!review) throw new NotFoundException('Performance review not found'); return review;
  }

  async createReview(organizationId: string, dto: CreateReviewDto) {
    const [employee, cycle, reviewType] = await Promise.all([
      this.prisma.employee.findFirst({ where: { id: dto.employeeId, organizationId, active: true } }),
      this.prisma.performanceCycle.findFirst({ where: { id: dto.performanceCycleId, program: { organizationId }, status: { in: ['DRAFT', 'OPEN'] } }, include: { program: true } }),
      this.prisma.performanceReviewType.findFirst({ where: { id: dto.reviewTypeId, active: true, program: { organizationId } } }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found'); if (!cycle) throw new NotFoundException('Performance cycle not found or is not available'); if (!reviewType) throw new NotFoundException('Performance review type not found');
    if (cycle.programId !== reviewType.programId) throw new ConflictException('Review type and cycle must belong to the same program');
    const assignment = await this.prisma.employeeOrganizationalUnit.findFirst({ where: { employeeId: employee.id, isPrimary: true, endDate: null }, include: { organizationalUnit: true, designation: true, supervisor: true } });
    const kpiIds = dto.kpis?.map((item) => item.kpiId) ?? []; const competencyIds = dto.competencies?.map((item) => item.competencyId) ?? [];
    if (!kpiIds.length && !competencyIds.length) throw new ConflictException('A review must contain at least one KPI or competency');
    if (new Set(kpiIds).size !== kpiIds.length) throw new ConflictException('A KPI cannot be assigned more than once to a review');
    if (new Set(competencyIds).size !== competencyIds.length) throw new ConflictException('A competency cannot be assigned more than once to a review');
    const allWeights = [...(dto.kpis ?? []).map((item) => Number(item.weight)), ...(dto.competencies ?? []).map((item) => Number(item.weight))];
    if (allWeights.some((weight) => !Number.isFinite(weight) || weight <= 0)) throw new ConflictException('All review assessment weights must be greater than zero');
    if (allWeights.reduce((sum, weight) => sum + weight, 0) <= 0) throw new ConflictException('Review assessment weights must total more than zero');
    const [kpis, competencies] = await Promise.all([this.prisma.kpi.findMany({ where: { id: { in: kpiIds }, organizationId, active: true } }), this.prisma.competency.findMany({ where: { id: { in: competencyIds }, organizationId, active: true } })]);
    if (kpis.length !== kpiIds.length) throw new NotFoundException('One or more KPIs were not found in the employee organization');
    if (competencies.length !== competencyIds.length) throw new NotFoundException('One or more competencies were not found in the employee organization');
    try {
      const review = await this.prisma.performanceReview.create({ data: { employeeId: employee.id, performanceCycleId: cycle.id, reviewTypeId: reviewType.id, organizationUnitIdSnapshot: assignment?.organizationalUnitId ?? null, designationIdSnapshot: assignment?.designationId ?? employee.designationId ?? null, supervisorEmployeeIdSnapshot: assignment?.supervisorEmployeeId ?? null, organizationUnitNameSnapshot: assignment?.organizationalUnit.name ?? null, designationNameSnapshot: assignment?.designation?.name ?? null, supervisorNameSnapshot: assignment?.supervisor ? `${assignment.supervisor.firstName} ${assignment.supervisor.lastName}` : null, startedAt: new Date(), kpis: { create: (dto.kpis ?? []).map((item) => { const kpi = kpis.find((entry) => entry.id === item.kpiId)!; return { kpiId: kpi.id, employeeId: employee.id, title: item.title?.trim() || kpi.name, description: item.description?.trim() || kpi.description, target: item.target?.trim() || null, measurementUnit: item.measurementUnit?.trim() || kpi.defaultUnit, weight: item.weight }; }) }, competencies: { create: (dto.competencies ?? []).map((item) => ({ competencyId: item.competencyId, weight: item.weight })) } }, include: { employee: true, performanceCycle: true, reviewType: true, kpis: { include: { kpi: true } }, competencies: { include: { competency: true } } } });
      await this.audit?.record({ action: 'REVIEW_CREATED', module: 'performance', entityType: 'PerformanceReview', entityId: review.id, newValues: { employeeId: review.employeeId, performanceCycleId: review.performanceCycleId, reviewTypeId: review.reviewTypeId, kpiCount: review.kpis.length, competencyCount: review.competencies.length } });
      return review;
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('A review already exists for this employee, cycle and review type'); throw error; }
  }

  async scoreKpi(organizationId: string, reviewId: string, kpiId: string, dto: UpdateKpiScoreDto, actor: 'employee' | 'supervisor') {
    const review = await this.requireReview(organizationId, reviewId); this.assertScoringStatus(review.status, actor);
    const kpi = await this.prisma.performanceKpi.findFirst({ where: { id: kpiId, performanceReviewId: review.id } }); if (!kpi) throw new NotFoundException('Performance KPI not found');
    const updated = await this.prisma.performanceKpi.update({ where: { id: kpi.id }, data: actor === 'employee' ? { employeeScore: dto.score, actualResult: dto.actualResult?.trim(), employeeComment: dto.comment?.trim() } : { supervisorScore: dto.score, actualResult: dto.actualResult?.trim(), supervisorComment: dto.comment?.trim() } });
    await this.audit?.record({ action: actor === 'employee' ? 'KPI_EMPLOYEE_SCORED' : 'KPI_SUPERVISOR_SCORED', module: 'performance', entityType: 'PerformanceKpi', entityId: kpi.id, newValues: { performanceReviewId: reviewId, score: dto.score, actor } });
    return updated;
  }

  async rateCompetency(organizationId: string, reviewId: string, competencyId: string, dto: UpdateCompetencyRatingDto, actor: 'employee' | 'supervisor') {
    const review = await this.requireReview(organizationId, reviewId); this.assertScoringStatus(review.status, actor);
    const competency = await this.prisma.performanceCompetency.findFirst({ where: { id: competencyId, performanceReviewId: review.id } }); if (!competency) throw new NotFoundException('Performance competency not found');
    const updated = await this.prisma.performanceCompetency.update({ where: { id: competency.id }, data: actor === 'employee' ? { employeeRating: dto.rating, employeeComment: dto.comment?.trim() } : { supervisorRating: dto.rating, supervisorComment: dto.comment?.trim() } });
    await this.audit?.record({ action: actor === 'employee' ? 'COMPETENCY_EMPLOYEE_RATED' : 'COMPETENCY_SUPERVISOR_RATED', module: 'performance', entityType: 'PerformanceCompetency', entityId: competency.id, newValues: { performanceReviewId: reviewId, rating: dto.rating, actor } });
    return updated;
  }

  async calculateScore(organizationId: string, reviewId: string, dto: CalculateScoreDto) {
    await this.requireReview(organizationId, reviewId);
    const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId }, include: { kpis: true, competencies: true } }); if (!review) throw new NotFoundException('Performance review not found');
    if (['FINALIZED', 'LOCKED', 'CANCELLED'].includes(review.status)) throw new ConflictException('Finalized, locked or cancelled reviews cannot be scored');
    if (!review.kpis.length && !review.competencies.length) throw new ConflictException('A review must contain at least one KPI or competency');
    const invalidKpiWeights = review.kpis.some((k) => !Number.isFinite(Number(k.weight)) || Number(k.weight) <= 0); const invalidCompetencyWeights = review.competencies.some((c) => !Number.isFinite(Number(c.weight)) || Number(c.weight) <= 0); if (invalidKpiWeights || invalidCompetencyWeights) throw new ConflictException('All review assessment weights must be greater than zero');
    const incompleteKpis = review.kpis.filter((k) => k.employeeScore === null && k.supervisorScore === null); const incompleteCompetencies = review.competencies.filter((c) => c.employeeRating === null && c.supervisorRating === null); if (incompleteKpis.length || incompleteCompetencies.length) throw new ConflictException(`All review assessments must be completed before scoring (${incompleteKpis.length} KPI(s), ${incompleteCompetencies.length} competency/competencies outstanding)`);
    const kpiWeight = review.kpis.reduce((sum, k) => sum + Number(k.weight), 0); const competencyWeight = review.competencies.reduce((sum, c) => sum + Number(c.weight), 0); const totalWeight = kpiWeight + competencyWeight; if (!Number.isFinite(totalWeight) || totalWeight <= 0) throw new ConflictException('Review assessment weights must total more than zero');
    const kpiScore = kpiWeight ? review.kpis.reduce((sum, k) => sum + Number(k.supervisorScore ?? k.employeeScore) * Number(k.weight), 0) / kpiWeight : null;
    const competencyScore = competencyWeight ? review.competencies.reduce((sum, c) => sum + Number(c.supervisorRating ?? c.employeeRating) * Number(c.weight), 0) / competencyWeight : null;
    const overallScore = ((kpiScore ?? 0) * kpiWeight + (competencyScore ?? 0) * competencyWeight) / totalWeight;
    let overallRating: string | null = null;
    if (dto.ratingScaleId) {
      const scale = await this.prisma.ratingScale.findFirst({ where: { id: dto.ratingScaleId, organizationId, active: true }, include: { items: { orderBy: { minScore: 'desc' } } } }); if (!scale) throw new NotFoundException('Rating scale not found');
      const item = scale.items.find((entry) => entry.minScore !== null && overallScore >= Number(entry.minScore) && (entry.maxScore === null || overallScore <= Number(entry.maxScore))); overallRating = item?.label ?? null;
    }
    const score = await this.prisma.performanceScore.create({ data: { performanceReviewId: reviewId, ratingScaleId: dto.ratingScaleId ?? null, kpiScore, competencyScore, overallScore, overallRating } });
    await this.audit?.record({ action: 'REVIEW_SCORE_CALCULATED', module: 'performance', entityType: 'PerformanceScore', entityId: score.id, newValues: { performanceReviewId: reviewId, kpiScore, competencyScore, overallScore, overallRating, ratingScaleId: dto.ratingScaleId ?? null } });
    return score;
  }

  private assertScoringStatus(status: string, actor: 'employee' | 'supervisor') { const employeeStatuses = ['DRAFT', 'IN_PROGRESS', 'RETURNED', 'RESUBMITTED']; const supervisorStatuses = ['SUBMITTED', 'UNDER_REVIEW']; const allowed = actor === 'employee' ? employeeStatuses : supervisorStatuses; if (!allowed.includes(status)) throw new ConflictException(actor === 'employee' ? 'Employee assessment is not allowed in the current review status' : 'Supervisor assessment is not allowed in the current review status'); }
  private async requireReview(organizationId: string, reviewId: string) { const review = await this.prisma.performanceReview.findFirst({ where: { id: reviewId, employee: { organizationId } } }); if (!review) throw new NotFoundException('Performance review not found'); return review; }
  private async requireProgram(organizationId: string, programId: string) { const program = await this.prisma.performanceProgram.findFirst({ where: { id: programId, organizationId, active: true } }); if (!program) throw new NotFoundException('Performance program not found'); return program; }
}

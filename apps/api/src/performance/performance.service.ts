import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateReviewTypeDto } from './dto/create-review-type.dto';
import { CreateKpiDto } from './dto/create-kpi.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import { CreateRatingScaleDto } from './dto/create-rating-scale.dto';

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
    try {
      return await this.prisma.ratingScale.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, items: { create: dto.items.map((item) => ({ value: item.value, label: item.label.trim(), description: item.description?.trim() || null, minScore: item.minScore, maxScore: item.maxScore })) } }, include: { items: { orderBy: { value: 'asc' } } } });
    } catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Rating scale code or value already exists'); throw error; }
  }

  private async requireProgram(organizationId: string, programId: string) {
    const program = await this.prisma.performanceProgram.findFirst({ where: { id: programId, organizationId, active: true } });
    if (!program) throw new NotFoundException('Performance program not found');
    return program;
  }
}

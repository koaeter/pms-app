import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateReviewTypeDto } from './dto/create-review-type.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  listPrograms(organizationId: string) {
    return this.prisma.performanceProgram.findMany({
      where: { organizationId, active: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { cycles: true, reviewTypes: true } } },
    });
  }

  async createProgram(organizationId: string, dto: CreateProgramDto) {
    try {
      return await this.prisma.performanceProgram.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Performance program code already exists');
      }
      throw error;
    }
  }

  async listCycles(organizationId: string, programId: string) {
    await this.requireProgram(organizationId, programId);
    return this.prisma.performanceCycle.findMany({
      where: { programId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createCycle(organizationId: string, programId: string, dto: CreateCycleDto) {
    await this.requireProgram(organizationId, programId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) throw new ConflictException('Cycle end date must be after start date');

    try {
      return await this.prisma.performanceCycle.create({
        data: {
          programId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          year: dto.year,
          startDate,
          endDate,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Performance cycle code already exists');
      }
      throw error;
    }
  }

  async listReviewTypes(organizationId: string, programId: string) {
    await this.requireProgram(organizationId, programId);
    return this.prisma.performanceReviewType.findMany({
      where: { programId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createReviewType(organizationId: string, programId: string, dto: CreateReviewTypeDto) {
    await this.requireProgram(organizationId, programId);
    try {
      return await this.prisma.performanceReviewType.create({
        data: {
          programId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Review type code already exists');
      }
      throw error;
    }
  }

  private async requireProgram(organizationId: string, programId: string) {
    const program = await this.prisma.performanceProgram.findFirst({
      where: { id: programId, organizationId, active: true },
    });
    if (!program) throw new NotFoundException('Performance program not found');
    return program;
  }
}

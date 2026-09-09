import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.organization.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async create(dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: { name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } });
  }

  async units(organizationId: string) {
    return this.prisma.organizationalUnit.findMany({
      where: { organizationId, active: true },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: { unitType: true, headEmployee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } },
    });
  }

  async createUnit(organizationId: string, dto: CreateUnitDto) {
    if (dto.parentId) {
      const parent = await this.prisma.organizationalUnit.findFirst({ where: { id: dto.parentId, organizationId, active: true } });
      if (!parent) throw new NotFoundException('Parent organizational unit not found');
    }
    if (dto.unitTypeId) {
      const type = await this.prisma.organizationalUnitType.findFirst({ where: { id: dto.unitTypeId, organizationId, active: true } });
      if (!type) throw new NotFoundException('Organizational unit type not found');
    }
    if (dto.headEmployeeId) {
      const employee = await this.prisma.employee.findFirst({ where: { id: dto.headEmployeeId, organizationId, active: true } });
      if (!employee) throw new NotFoundException('Unit head not found');
    }
    try {
      return await this.prisma.organizationalUnit.create({ data: {
        organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null,
        parentId: dto.parentId || null, unitTypeId: dto.unitTypeId || null, headEmployeeId: dto.headEmployeeId || null, level: dto.level,
      }, include: { unitType: true, parent: true, headEmployee: true } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Organizational unit code already exists');
      throw error;
    }
  }
}

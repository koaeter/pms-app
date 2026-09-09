import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateUnitTypeDto } from './dto/create-unit-type.dto';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateReportingRelationshipDto } from './dto/create-reporting-relationship.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  list() { return this.prisma.organization.findMany({ where: { active: true }, orderBy: { name: 'asc' } }); }

  async create(dto: CreateOrganizationDto) {
    try { return await this.prisma.organization.create({ data: { name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Organization code already exists'); throw error; }
  }

  async units(organizationId: string) {
    return this.prisma.organizationalUnit.findMany({ where: { organizationId, active: true }, orderBy: [{ level: 'asc' }, { parentId: 'asc' }, { name: 'asc' }], include: { unitType: true, parent: { select: { id: true, name: true, code: true } }, headEmployee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } } });
  }

  async unitTypes(organizationId: string) { return this.prisma.organizationalUnitType.findMany({ where: { organizationId, active: true }, orderBy: [{ level: 'asc' }, { name: 'asc' }] }); }

  async designations(organizationId: string) { return this.prisma.designation.findMany({ where: { organizationId, active: true }, orderBy: { name: 'asc' } }); }

  async createUnitType(organizationId: string, dto: CreateUnitTypeDto) {
    try { return await this.prisma.organizationalUnitType.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, level: dto.level } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Organizational unit type code already exists'); throw error; }
  }

  async createDesignation(organizationId: string, dto: CreateDesignationDto) {
    try { return await this.prisma.designation.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, gradeLevel: dto.gradeLevel?.trim() || null } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Designation code already exists'); throw error; }
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
    try { return await this.prisma.organizationalUnit.create({ data: { organizationId, name: dto.name.trim(), code: dto.code.trim().toUpperCase(), description: dto.description?.trim() || null, parentId: dto.parentId || null, unitTypeId: dto.unitTypeId || null, headEmployeeId: dto.headEmployeeId || null, level: dto.level }, include: { unitType: true, parent: true, headEmployee: true } }); }
    catch (error) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Organizational unit code already exists'); throw error; }
  }

  async assignments(organizationId: string) {
    return this.prisma.employeeOrganizationalUnit.findMany({ where: { employee: { organizationId }, endDate: null }, orderBy: { startDate: 'desc' }, include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } }, organizationalUnit: { select: { id: true, name: true, code: true } }, designation: true, supervisor: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } } });
  }

  async createAssignment(organizationId: string, dto: CreateAssignmentDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, organizationId, active: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    const unit = await this.prisma.organizationalUnit.findFirst({ where: { id: dto.organizationalUnitId, organizationId, active: true } });
    if (!unit) throw new NotFoundException('Organizational unit not found');
    if (dto.designationId) { const d = await this.prisma.designation.findFirst({ where: { id: dto.designationId, organizationId, active: true } }); if (!d) throw new NotFoundException('Designation not found'); }
    if (dto.supervisorEmployeeId) { if (dto.supervisorEmployeeId === dto.employeeId) throw new ConflictException('An employee cannot supervise themselves'); const s = await this.prisma.employee.findFirst({ where: { id: dto.supervisorEmployeeId, organizationId, active: true } }); if (!s) throw new NotFoundException('Supervisor employee not found'); }
    const startDate = new Date(dto.startDate); const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate <= startDate) throw new ConflictException('Assignment end date must be after start date');
    if (dto.isPrimary ?? true) await this.prisma.employeeOrganizationalUnit.updateMany({ where: { employeeId: dto.employeeId, isPrimary: true, endDate: null }, data: { endDate: startDate } });
    return this.prisma.employeeOrganizationalUnit.create({ data: { employeeId: dto.employeeId, organizationalUnitId: dto.organizationalUnitId, designationId: dto.designationId || null, supervisorEmployeeId: dto.supervisorEmployeeId || null, isPrimary: dto.isPrimary ?? true, startDate, endDate }, include: { organizationalUnit: true, designation: true, supervisor: true } });
  }

  async reportingRelationships(organizationId: string) {
    return this.prisma.reportingRelationship.findMany({ where: { employee: { organizationId }, active: true }, orderBy: { startDate: 'desc' }, include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } }, reportsToEmployee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } } } });
  }

  async createReportingRelationship(organizationId: string, dto: CreateReportingRelationshipDto) {
    if (dto.employeeId === dto.reportsToEmployeeId) throw new ConflictException('An employee cannot report to themselves');
    const ids = [dto.employeeId, dto.reportsToEmployeeId];
    const employees = await this.prisma.employee.findMany({ where: { id: { in: ids }, organizationId, active: true }, select: { id: true } });
    if (employees.length !== 2) throw new NotFoundException('One or both employees were not found');
    const startDate = new Date(dto.startDate); const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate <= startDate) throw new ConflictException('Reporting relationship end date must be after start date');
    return this.prisma.reportingRelationship.create({ data: { employeeId: dto.employeeId, reportsToEmployeeId: dto.reportsToEmployeeId, relationshipType: dto.relationshipType, startDate, endDate }, include: { employee: true, reportsToEmployee: true } });
  }
}

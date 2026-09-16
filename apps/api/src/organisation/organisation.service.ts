import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OrganisationService {
  constructor(private readonly prisma: PrismaService) {}

  listOrganisations() {
    return this.prisma.organisation.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { departments: true, designations: true, employees: true } } },
    });
  }

  createOrganisation(data: { name: string; code: string; description?: string }) {
    return this.prisma.organisation.create({ data: { ...data, name: data.name.trim(), code: data.code.trim().toUpperCase() } });
  }

  async updateOrganisation(id: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }) {
    await this.requireOrganisation(id);
    return this.prisma.organisation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.code !== undefined ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  listDepartments(organisationId: string) {
    return this.prisma.department.findMany({ where: { organisationId }, orderBy: { name: 'asc' }, include: { parent: true, _count: { select: { employees: true, children: true } } } });
  }

  async createDepartment(data: { organisationId: string; name: string; code: string; parentId?: string }) {
    await this.requireOrganisation(data.organisationId);
    if (data.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: data.parentId, organisationId: data.organisationId } });
      if (!parent) throw new NotFoundException('Parent department not found in this organisation');
    }
    return this.prisma.department.create({ data: { ...data, name: data.name.trim(), code: data.code.trim().toUpperCase() } });
  }

  async updateDepartment(id: string, data: { name?: string; code?: string; parentId?: string | null }) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    if (data.parentId === id) throw new BadRequestException('A department cannot be its own parent');
    if (data.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: data.parentId, organisationId: department.organisationId } });
      if (!parent) throw new NotFoundException('Parent department not found in this organisation');
    }
    return this.prisma.department.update({ where: { id }, data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.code !== undefined ? { code: data.code.trim().toUpperCase() } : {}), ...(data.parentId !== undefined ? { parentId: data.parentId } : {}) } });
  }

  listDesignations(organisationId: string) {
    return this.prisma.designation.findMany({ where: { organisationId }, orderBy: [{ grade: 'asc' }, { name: 'asc' }], include: { _count: { select: { employees: true } } } });
  }

  async createDesignation(data: { organisationId: string; name: string; code?: string; grade?: string }) {
    await this.requireOrganisation(data.organisationId);
    return this.prisma.designation.create({ data: { ...data, name: data.name.trim(), code: data.code?.trim().toUpperCase() || undefined } });
  }

  async updateDesignation(id: string, data: { name?: string; code?: string | null; grade?: string | null }) {
    const designation = await this.prisma.designation.findUnique({ where: { id } });
    if (!designation) throw new NotFoundException('Designation not found');
    return this.prisma.designation.update({ where: { id }, data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}), ...(data.code !== undefined ? { code: data.code?.trim().toUpperCase() || null } : {}), ...(data.grade !== undefined ? { grade: data.grade } : {}) } });
  }

  listEmployees(organisationId: string) {
    return this.prisma.employee.findMany({
      where: { organisationId },
      orderBy: { employeeNumber: 'asc' },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true } },
        department: true,
        designation: true,
        manager: { select: { id: true, employeeNumber: true, user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async assignEmployee(data: { userId: string; employeeNumber: string; organisationId: string; departmentId?: string; designationId?: string; managerId?: string }) {
    await this.requireOrganisation(data.organisationId);
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!data.employeeNumber.trim()) throw new BadRequestException('Employee number is required');
    if (data.departmentId && !(await this.prisma.department.findFirst({ where: { id: data.departmentId, organisationId: data.organisationId } }))) throw new NotFoundException('Department not found in this organisation');
    if (data.designationId && !(await this.prisma.designation.findFirst({ where: { id: data.designationId, organisationId: data.organisationId } }))) throw new NotFoundException('Designation not found in this organisation');
    if (data.managerId && !(await this.prisma.employee.findFirst({ where: { id: data.managerId, organisationId: data.organisationId } }))) throw new NotFoundException('Manager not found in this organisation');
    const existing = await this.prisma.employee.findUnique({ where: { userId: data.userId } });
    if (existing && data.managerId === existing.id) throw new BadRequestException('An employee cannot be their own manager');
    return this.prisma.employee.upsert({ where: { userId: data.userId }, create: { ...data, employeeNumber: data.employeeNumber.trim() }, update: { employeeNumber: data.employeeNumber.trim(), organisationId: data.organisationId, departmentId: data.departmentId, designationId: data.designationId, managerId: data.managerId } });
  }

  private async requireOrganisation(id: string) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id } });
    if (!organisation) throw new NotFoundException('Organisation not found');
    return organisation;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.organisation.create({ data });
  }

  listDepartments(organisationId: string) {
    return this.prisma.department.findMany({ where: { organisationId }, orderBy: { name: 'asc' }, include: { parent: true } });
  }

  async createDepartment(data: { organisationId: string; name: string; code: string; parentId?: string }) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id: data.organisationId } });
    if (!organisation) throw new NotFoundException('Organisation not found');
    if (data.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: data.parentId, organisationId: data.organisationId } });
      if (!parent) throw new NotFoundException('Parent department not found in this organisation');
    }
    return this.prisma.department.create({ data });
  }

  listDesignations(organisationId: string) {
    return this.prisma.designation.findMany({ where: { organisationId }, orderBy: { name: 'asc' } });
  }

  async createDesignation(data: { organisationId: string; name: string; code?: string; grade?: string }) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id: data.organisationId } });
    if (!organisation) throw new NotFoundException('Organisation not found');
    return this.prisma.designation.create({ data });
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
    const organisation = await this.prisma.organisation.findUnique({ where: { id: data.organisationId } });
    if (!organisation) throw new NotFoundException('Organisation not found');
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundException('User not found');
    if (data.departmentId && !(await this.prisma.department.findFirst({ where: { id: data.departmentId, organisationId: data.organisationId } }))) throw new NotFoundException('Department not found in this organisation');
    if (data.designationId && !(await this.prisma.designation.findFirst({ where: { id: data.designationId, organisationId: data.organisationId } }))) throw new NotFoundException('Designation not found in this organisation');
    if (data.managerId && !(await this.prisma.employee.findFirst({ where: { id: data.managerId, organisationId: data.organisationId } }))) throw new NotFoundException('Manager not found in this organisation');
    return this.prisma.employee.upsert({ where: { userId: data.userId }, create: data, update: { employeeNumber: data.employeeNumber, organisationId: data.organisationId, departmentId: data.departmentId, designationId: data.designationId, managerId: data.managerId } });
  }
}

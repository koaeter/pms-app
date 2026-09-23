import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createPasswordHash } from '../auth/auth.service';
import { AuditService } from '../audit.service';

type OrganisationUser = { id: string; organisationId?: string | null; roles: string[] };

@Injectable()
export class OrganisationService {
  constructor(private readonly prisma: PrismaService, private readonly audit?: AuditService) {}

  listOrganisations(user: OrganisationUser) {
    const where = user.roles.includes('SYSTEM_ADMIN') ? undefined : { id: user.organisationId ?? '__none__' };
    return this.prisma.organisation.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { departments: true, designations: true, employees: true } } },
    });
  }

  async createOrganisation(data: { name: string; code: string; description?: string }, user: OrganisationUser) {
    if (!user.roles.includes('SYSTEM_ADMIN')) throw new ForbiddenException('Only system administrators can create organisations');
    const name = data.name.trim();
    const code = data.code.trim().toUpperCase();
    if (!name) throw new BadRequestException('Organisation name is required');
    if (!code) throw new BadRequestException('Organisation code is required');
    return this.prisma.organisation.create({ data: { ...data, name, code } });
  }

  async updateOrganisation(id: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }, user: OrganisationUser) {
    await this.requireOrganisationAccess(id, user);
    const name = data.name?.trim();
    const code = data.code?.trim().toUpperCase();
    if (data.name !== undefined && !name) throw new BadRequestException('Organisation name is required');
    if (data.code !== undefined && !code) throw new BadRequestException('Organisation code is required');
    return this.prisma.organisation.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async listDepartments(organisationId: string, user: OrganisationUser) {
    await this.requireOrganisationAccess(organisationId, user);
    return this.prisma.department.findMany({ where: { organisationId }, orderBy: { name: 'asc' }, include: { parent: true, _count: { select: { employees: true, children: true } } } });
  }

  async createDepartment(data: { organisationId: string; name: string; code: string; parentId?: string }, user: OrganisationUser) {
    await this.requireOrganisationAccess(data.organisationId, user);
    const name = data.name.trim();
    const code = data.code.trim().toUpperCase();
    if (!name) throw new BadRequestException('Department name is required');
    if (!code) throw new BadRequestException('Department code is required');
    if (data.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: data.parentId, organisationId: data.organisationId } });
      if (!parent) throw new NotFoundException('Parent department not found in this organisation');
    }
    return this.prisma.department.create({ data: { ...data, name, code } });
  }

  async updateDepartment(id: string, data: { name?: string; code?: string; parentId?: string | null }, user: OrganisationUser) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    await this.requireOrganisationAccess(department.organisationId, user);
    if (data.parentId === id) throw new BadRequestException('A department cannot be its own parent');
    if (data.parentId) {
      const parent = await this.prisma.department.findFirst({ where: { id: data.parentId, organisationId: department.organisationId } });
      if (!parent) throw new NotFoundException('Parent department not found in this organisation');
      const visited = new Set<string>();
      let currentId: string | null = data.parentId;
      while (currentId) {
        if (currentId === id) throw new BadRequestException('Department parent assignment would create a hierarchy cycle');
        if (visited.has(currentId)) throw new BadRequestException('Department parent assignment contains a hierarchy cycle');
        visited.add(currentId);
        const current: { id: string; parentId: string | null; organisationId: string } | null = await this.prisma.department.findUnique({ where: { id: currentId }, select: { id: true, parentId: true, organisationId: true } });
        if (!current || current.organisationId !== department.organisationId) break;
        currentId = current.parentId;
      }
    }
    const name = data.name?.trim();
    const code = data.code?.trim().toUpperCase();
    if (data.name !== undefined && !name) throw new BadRequestException('Department name is required');
    if (data.code !== undefined && !code) throw new BadRequestException('Department code is required');
    return this.prisma.department.update({ where: { id }, data: { ...(name !== undefined ? { name } : {}), ...(code !== undefined ? { code } : {}), ...(data.parentId !== undefined ? { parentId: data.parentId } : {}) } });
  }

  async listDesignations(organisationId: string, user: OrganisationUser) {
    await this.requireOrganisationAccess(organisationId, user);
    return this.prisma.designation.findMany({ where: { organisationId }, orderBy: [{ grade: 'asc' }, { name: 'asc' }], include: { _count: { select: { employees: true } } } });
  }

  async createDesignation(data: { organisationId: string; name: string; code?: string; grade?: string }, user: OrganisationUser) {
    await this.requireOrganisationAccess(data.organisationId, user);
    const name = data.name.trim();
    const code = data.code?.trim().toUpperCase() || undefined;
    if (!name) throw new BadRequestException('Designation name is required');
    return this.prisma.designation.create({ data: { ...data, name, code } });
  }

  async updateDesignation(id: string, data: { name?: string; code?: string | null; grade?: string | null }, user: OrganisationUser) {
    const designation = await this.prisma.designation.findUnique({ where: { id } });
    if (!designation) throw new NotFoundException('Designation not found');
    await this.requireOrganisationAccess(designation.organisationId, user);
    const name = data.name?.trim();
    const code = data.code?.trim().toUpperCase() || null;
    if (data.name !== undefined && !name) throw new BadRequestException('Designation name is required');
    return this.prisma.designation.update({ where: { id }, data: { ...(name !== undefined ? { name } : {}), ...(data.code !== undefined ? { code } : {}), ...(data.grade !== undefined ? { grade: data.grade } : {}) } });
  }

  async listEmployees(organisationId: string, user: OrganisationUser) {
    await this.requireOrganisationAccess(organisationId, user);
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

  async createEmployeeWithAccount(data: { username: string; password: string; firstName: string; lastName: string; email?: string; employeeNumber: string; organisationId: string; departmentId?: string; designationId?: string; managerId?: string }, user: OrganisationUser) {
    await this.requireOrganisationAccess(data.organisationId, user);
    const username = data.username.trim();
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email?.trim() || undefined;
    const employeeNumber = data.employeeNumber.trim();
    if (!username || !firstName || !lastName || !employeeNumber) throw new BadRequestException('Username, name and employee number are required');
    if (data.password.length < 10) throw new BadRequestException('Password must be at least 10 characters');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Email address is invalid');
    if (data.departmentId && !(await this.prisma.department.findFirst({ where: { id: data.departmentId, organisationId: data.organisationId } }))) throw new NotFoundException('Department not found in this organisation');
    if (data.designationId && !(await this.prisma.designation.findFirst({ where: { id: data.designationId, organisationId: data.organisationId } }))) throw new NotFoundException('Designation not found in this organisation');
    if (data.managerId && !(await this.prisma.employee.findFirst({ where: { id: data.managerId, organisationId: data.organisationId } }))) throw new NotFoundException('Manager not found in this organisation');

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const createdUser = await tx.user.create({
          data: { username, passwordHash: createPasswordHash(data.password), firstName, lastName, email },
          select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true },
        });
        const employee = await tx.employee.create({
          data: { userId: createdUser.id, employeeNumber, organisationId: data.organisationId, departmentId: data.departmentId, designationId: data.designationId, managerId: data.managerId },
          select: { id: true, employeeNumber: true, userId: true, organisationId: true },
        });
        return { user: createdUser, employee };
      }).then(async (result) => {
        await this.audit?.record('EMPLOYEE_ACCOUNT_PROVISIONED', 'Employee', result.employee.id, user.id, { userId: result.user.id, username: result.user.username });
        return result;
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new BadRequestException('Username, email or employee number is already in use');
      throw error;
    }
  }

  async createEmployee(data: { employeeNumber: string; organisationId: string; departmentId?: string; designationId?: string; managerId?: string }, user: OrganisationUser) {
    await this.requireOrganisationAccess(data.organisationId, user);
    const employeeNumber = data.employeeNumber.trim();
    if (!employeeNumber) throw new BadRequestException('Employee number is required');
    if (data.departmentId && !(await this.prisma.department.findFirst({ where: { id: data.departmentId, organisationId: data.organisationId } }))) {
      throw new NotFoundException('Department not found in this organisation');
    }
    if (data.designationId && !(await this.prisma.designation.findFirst({ where: { id: data.designationId, organisationId: data.organisationId } }))) {
      throw new NotFoundException('Designation not found in this organisation');
    }
    if (data.managerId && !(await this.prisma.employee.findFirst({ where: { id: data.managerId, organisationId: data.organisationId } }))) {
      throw new NotFoundException('Manager not found in this organisation');
    }
    if (data.managerId) {
      const visited = new Set<string>();
      let currentId: string | null = data.managerId;
      while (currentId) {
        if (visited.has(currentId)) throw new BadRequestException('Manager assignment contains an organisational reporting cycle');
        visited.add(currentId);
        const manager: { id: string; managerId: string | null; organisationId: string | null } | null = await this.prisma.employee.findUnique({
          where: { id: currentId },
          select: { id: true, managerId: true, organisationId: true },
        });
        if (!manager || manager.organisationId !== data.organisationId) break;
        currentId = manager.managerId;
      }
    }
    try {
      const employee = await this.prisma.employee.create({
        data: { employeeNumber, organisationId: data.organisationId, departmentId: data.departmentId, designationId: data.designationId, managerId: data.managerId },
      });
      await this.audit?.record('EMPLOYEE_CREATED', 'Employee', employee.id, user.id, { employeeNumber, organisationId: data.organisationId });
      return employee;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new BadRequestException('Employee number is already in use');
      }
      throw error;
    }
  }

  async assignEmployee(data: { userId: string; employeeNumber: string; organisationId: string; departmentId?: string; designationId?: string; managerId?: string }, user: OrganisationUser) {
    await this.requireOrganisationAccess(data.organisationId, user);
    const targetUser = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!targetUser) throw new NotFoundException('User not found');
    if (!data.employeeNumber.trim()) throw new BadRequestException('Employee number is required');
    if (data.departmentId && !(await this.prisma.department.findFirst({ where: { id: data.departmentId, organisationId: data.organisationId } }))) throw new NotFoundException('Department not found in this organisation');
    if (data.designationId && !(await this.prisma.designation.findFirst({ where: { id: data.designationId, organisationId: data.organisationId } }))) throw new NotFoundException('Designation not found in this organisation');
    if (data.managerId && !(await this.prisma.employee.findFirst({ where: { id: data.managerId, organisationId: data.organisationId } }))) throw new NotFoundException('Manager not found in this organisation');
    const existing = await this.prisma.employee.findUnique({ where: { userId: data.userId } });
    if (existing && existing.organisationId !== data.organisationId && !user.roles.includes('SYSTEM_ADMIN')) {
      throw new ForbiddenException('Only a system administrator can move an employee between organisations');
    }
    if (existing && data.managerId === existing.id) throw new BadRequestException('An employee cannot be their own manager');
    if (data.managerId) {
      const visited = new Set<string>();
      let currentId: string | null = data.managerId;
      while (currentId) {
        if (currentId === existing?.id) throw new BadRequestException('Manager assignment would create an organisational reporting cycle');
        if (visited.has(currentId)) throw new BadRequestException('Manager assignment contains an organisational reporting cycle');
        visited.add(currentId);
        const manager: { id: string; managerId: string | null; organisationId: string | null } | null = await this.prisma.employee.findUnique({ where: { id: currentId }, select: { id: true, managerId: true, organisationId: true } });
        if (!manager || manager.organisationId !== data.organisationId) break;
        currentId = manager.managerId;
      }
    }
    return this.prisma.employee.upsert({ where: { userId: data.userId }, create: { ...data, employeeNumber: data.employeeNumber.trim() }, update: { employeeNumber: data.employeeNumber.trim(), organisationId: data.organisationId, departmentId: data.departmentId, designationId: data.designationId, managerId: data.managerId } });
  }

  private async requireOrganisationAccess(id: string, user: OrganisationUser) {
    const organisation = await this.prisma.organisation.findUnique({ where: { id } });
    if (!organisation) throw new NotFoundException('Organisation not found');
    if (user.roles.includes('SYSTEM_ADMIN')) return organisation;
    if (user.organisationId === id) return organisation;
    throw new ForbiddenException('You are not authorised to access this organisation');
  }
}

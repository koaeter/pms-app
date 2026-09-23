import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createPasswordHash } from '../auth/auth.service';
import { AuditService } from '../audit.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private require(user: { permissions: string[] }, permission: string) {
    if (!user.permissions.includes(permission)) throw new ForbiddenException('Insufficient permission');
  }

  private requireTargetOrganisation(actor: { roles?: string[]; organisationId?: string | null }, targetOrganisationId: string | null) {
    if (actor.roles?.includes('SYSTEM_ADMIN')) return;
    if (!actor.organisationId || targetOrganisationId !== actor.organisationId) {
      throw new ForbiddenException('You are not authorised to manage users outside your organisation');
    }
  }

  listUsers(user: { permissions: string[]; roles?: string[]; organisationId?: string | null }) {
    this.require(user, 'users.read');
    const where = user.roles?.includes('SYSTEM_ADMIN') ? undefined : { employee: { organisationId: user.organisationId ?? '__none__' } };
    return this.prisma.user.findMany({ where, orderBy: { username: 'asc' }, select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true, createdAt: true, roles: { include: { role: true } }, employee: { include: { organisation: true, department: true, designation: true, manager: { include: { user: true } } } } } });
  }

  async createUser(actor: { id: string; permissions: string[] }, data: { username: string; password: string; firstName: string; lastName: string; email?: string }) {
    this.require(actor, 'users.manage');

    const username = data.username.trim();
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email?.trim() || undefined;

    if (!username) throw new BadRequestException('Username is required');
    if (!firstName) throw new BadRequestException('First name is required');
    if (!lastName) throw new BadRequestException('Last name is required');
    if (email && !/^\\S+@\\S+\\.\\S+$/.test(email)) throw new BadRequestException('Email address is invalid');
    if (data.password.length < 10) throw new BadRequestException('Password must be at least 10 characters');

    try {
      const user = await this.prisma.user.create({
        data: { username, passwordHash: createPasswordHash(data.password), firstName, lastName, email },
        select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true },
      });
      await this.audit.record('USER_CREATED', 'User', user.id, actor.id, { username: user.username });
      return user;
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new BadRequestException('Username or email is already in use');
      }
      throw error;
    }
  }

  async setUserStatus(actor: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null }, userId: string, isActive: boolean) {
    this.require(actor, 'users.manage');
    if (actor.id === userId && !isActive) throw new BadRequestException('You cannot deactivate your own account');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
    if (!user) throw new NotFoundException('User not found');
    this.requireTargetOrganisation(actor, user.employee?.organisationId ?? null);
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isActive }, select: { id: true, username: true, isActive: true } });
    if (!isActive) await this.prisma.session.deleteMany({ where: { userId } });
    await this.audit.record('USER_STATUS_CHANGED', 'User', userId, actor.id, { isActive });
    return updated;
  }

  listRoles(user: { permissions: string[] }) {
    this.require(user, 'roles.read');
    return this.prisma.role.findMany({ orderBy: { name: 'asc' }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  }

  async assignRole(actor: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null }, userId: string, roleId: string) {
    this.require(actor, 'roles.manage');
    const [user, role] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId }, include: { employee: true } }), this.prisma.role.findUnique({ where: { id: roleId } })]);
    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');
    this.requireTargetOrganisation(actor, user.employee?.organisationId ?? null);
    if (!actor.roles?.includes('SYSTEM_ADMIN') && ['SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role.name)) {
      throw new ForbiddenException('Only a system administrator can assign elevated administrative roles');
    }
    const assignment = await this.prisma.userRole.upsert({ where: { userId_roleId: { userId, roleId } }, update: {}, create: { userId, roleId } });
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.audit.record('USER_ROLE_ASSIGNED', 'User', userId, actor.id, { role: role.name, roleId });
    return assignment;
  }

  async removeRole(actor: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null }, userId: string, roleId: string) {
    this.require(actor, 'roles.manage');
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, include: { employee: true } }),
      this.prisma.role.findUnique({ where: { id: roleId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');
    this.requireTargetOrganisation(actor, user.employee?.organisationId ?? null);
    if (actor.id === userId && ['SYSTEM_ADMIN', 'HR_ADMIN', 'PERFORMANCE_ADMIN'].includes(role.name)) {
      throw new BadRequestException('You cannot remove an elevated role from your own account');
    }
    if (actor.roles?.includes('SYSTEM_ADMIN') === false && role.name === 'SYSTEM_ADMIN') {
      throw new ForbiddenException('Only a system administrator can remove the system administrator role');
    }
    const result = await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
    if (result.count !== 1) throw new NotFoundException('Role assignment not found');
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.audit.record('USER_ROLE_REMOVED', 'User', userId, actor.id, { role: role.name, roleId });
    return { userId, roleId, removed: true };
  }

  async listAudit(user: { permissions: string[]; roles?: string[]; organisationId?: string | null }) {
    this.require(user, 'audit.read');
    if (user.roles?.includes('SYSTEM_ADMIN')) {
      return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    }
    if (!user.organisationId) return [];
    const actors = await this.prisma.user.findMany({
      where: { employee: { organisationId: user.organisationId } },
      select: { id: true },
    });
    return this.prisma.auditLog.findMany({
      where: { actorId: { in: actors.map((actor) => actor.id) } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }}

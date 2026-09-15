import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createPasswordHash } from '../auth/auth.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private require(user: { permissions: string[] }, permission: string) {
    if (!user.permissions.includes(permission)) throw new ForbiddenException('Insufficient permission');
  }

  listUsers(user: { permissions: string[] }) {
    this.require(user, 'users.read');
    return this.prisma.user.findMany({ orderBy: { username: 'asc' }, select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true, createdAt: true, roles: { include: { role: true } }, employee: { include: { organisation: true, department: true, designation: true, manager: { include: { user: true } } } } } });
  }

  async createUser(actor: { id: string; permissions: string[] }, data: { username: string; password: string; firstName: string; lastName: string; email?: string }) {
    this.require(actor, 'users.manage');
    if (data.password.length < 10) throw new BadRequestException('Password must be at least 10 characters');
    return this.prisma.user.create({ data: { ...data, passwordHash: createPasswordHash(data.password) }, select: { id: true, username: true, firstName: true, lastName: true, email: true, isActive: true } });
  }

  async setUserStatus(actor: { id: string; permissions: string[] }, userId: string, isActive: boolean) {
    this.require(actor, 'users.manage');
    if (actor.id === userId && !isActive) throw new BadRequestException('You cannot deactivate your own account');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id: userId }, data: { isActive }, select: { id: true, username: true, isActive: true } });
  }

  listRoles(user: { permissions: string[] }) {
    this.require(user, 'roles.read');
    return this.prisma.role.findMany({ orderBy: { name: 'asc' }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
  }

  async assignRole(actor: { id: string; permissions: string[] }, userId: string, roleId: string) {
    this.require(actor, 'roles.manage');
    const [user, role] = await Promise.all([this.prisma.user.findUnique({ where: { id: userId } }), this.prisma.role.findUnique({ where: { id: roleId } })]);
    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');
    return this.prisma.userRole.upsert({ where: { userId_roleId: { userId, roleId } }, update: {}, create: { userId, roleId } });
  }

  listAudit(user: { permissions: string[] }) {
    this.require(user, 'audit.read');
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma.service';
import { AuthRequest } from '../types/auth-request';

export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'pms_session';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const rawToken = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!rawToken) throw new UnauthorizedException('Authentication required');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            employee: {
              select: { id: true, organizationId: true, employeeNumber: true, firstName: true, lastName: true },
            },
            roles: {
              where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('Authentication required');
    }

    await this.prisma.session.update({ where: { id: session.id }, data: { lastActivityAt: new Date() } });
    request.sessionId = session.id;
    request.user = {
      id: session.user.id,
      employeeId: session.user.employeeId,
      username: session.user.username,
      accountStatus: session.user.accountStatus,
      employee: session.user.employee,
      roles: session.user.roles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        organizationId: ur.role.organizationId,
        organizationalUnitId: ur.role.organizationalUnitId,
        permissions: ur.role.permissions.map((rp) => ({ code: rp.permission.code, scope: rp.scope })),
      })),
    };
    return true;
  }
}

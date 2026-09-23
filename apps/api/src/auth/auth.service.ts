import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.service';

const SESSION_HOURS = 8;

function hashPassword(password: string, salt: Buffer) {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${hashPassword(password, salt)}`;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { employee: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) throw new UnauthorizedException('Invalid username or password');

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
    await this.prisma.session.create({ data: { tokenHash, userId: user.id, expiresAt } });

    return { token, expiresAt, user: this.presentUser(user) };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 10) throw new UnauthorizedException('New password must be at least 10 characters');
    if (currentPassword === newPassword) throw new UnauthorizedException('New password must be different from the current password');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, isActive: true } });
    if (!user || !user.isActive || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: createPasswordHash(newPassword) },
    });
    await this.prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  }

  async logout(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.session.deleteMany({ where: { tokenHash } });
    return { success: true };
  }


  async currentUser(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { employee: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) throw new UnauthorizedException('Session expired or invalid');
    return this.presentUser(session.user);
  }


  private presentUser(user: any) {
    const roles = user.roles.map((entry: any) => entry.role.name);
    const permissions = [...new Set(user.roles.flatMap((entry: any) => entry.role.permissions.map((item: any) => item.permission.code)))];
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employee?.id ?? null,
      organisationId: user.employee?.organisationId ?? null,
      roles,
      permissions,
    };
  }
}

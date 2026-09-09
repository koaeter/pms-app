import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthRequest } from './types/auth-request';
import { SESSION_COOKIE } from './guards/session.guard';

const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto, request: AuthRequest, response: Response) {
    const username = dto.username.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { username } });
    const now = new Date();

    if (!user) {
      await this.logAuthEvent(null, 'LOGIN_FAILURE', false, request, { reason: 'invalid_credentials' });
      throw new UnauthorizedException('Invalid username or password');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.logAuthEvent(user.id, 'LOGIN_FAILURE', false, request, { reason: 'account_locked' });
      throw new UnauthorizedException('Invalid username or password');
    }

    if (user.accountStatus !== 'ACTIVE') {
      await this.logAuthEvent(user.id, 'LOGIN_FAILURE', false, request, { reason: 'account_unavailable' });
      throw new UnauthorizedException('Invalid username or password');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      const failures = user.failedLoginCount + 1;
      const locked = failures >= MAX_LOGIN_FAILURES;
      const lockedUntil = locked ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failures, lockedUntil },
      });
      await this.logAuthEvent(user.id, locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILURE', false, request, {
        reason: 'invalid_credentials',
        failedLoginCount: failures,
      });
      throw new UnauthorizedException('Invalid username or password');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 8);
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60_000);

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash,
          ipAddress: request.ip,
          userAgent: request.get('user-agent') ?? null,
          expiresAt,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
      });
      await tx.authenticationEvent.create({
        data: { userId: user.id, eventType: 'LOGIN_SUCCESS', success: true, ipAddress: request.ip, userAgent: request.get('user-agent') ?? null },
      });
      return created;
    });

    response.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return { authenticated: true, sessionExpiresAt: session.expiresAt };
  }

  async logout(request: AuthRequest, response: Response) {
    await this.prisma.session.updateMany({
      where: { id: request.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.logAuthEvent(request.user.id, 'LOGOUT', true, request);
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    return { authenticated: false };
  }

  async me(request: AuthRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        username: true,
        accountStatus: true,
        mfaEnabled: true,
        lastLoginAt: true,
        employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true } },
      },
    });
    return { user, roles: request.user.roles };
  }

  private async logAuthEvent(userId: string | null, eventType: any, success: boolean, request: AuthRequest, metadata?: Record<string, unknown>) {
    await this.prisma.authenticationEvent.create({
      data: { userId, eventType, success, ipAddress: request.ip, userAgent: request.get('user-agent') ?? null, metadata },
    });
  }
}

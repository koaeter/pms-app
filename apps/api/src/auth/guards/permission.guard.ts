import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionScope } from '@prisma/client';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { AuthRequest } from '../types/auth-request';

interface Requirement { code: string; scope?: PermissionScope }

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<Requirement | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const allowed = request.user.roles.some((role) =>
      role.permissions.some((permission) =>
        permission.code === requirement.code && (!requirement.scope || permission.scope === requirement.scope || permission.scope === PermissionScope.GLOBAL),
      ),
    );

    if (!allowed) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

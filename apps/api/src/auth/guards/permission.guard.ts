import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionScope } from '@prisma/client';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
import { AuthRequest } from '../types/auth-request';

interface Requirement { code: string; scope?: PermissionScope }

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private scopeAllows(actual: PermissionScope, required: PermissionScope): boolean {
    if (actual === PermissionScope.GLOBAL) return true;
    if (actual === required) return true;

    const rank: Record<PermissionScope, number> = {
      [PermissionScope.OWN]: 1,
      [PermissionScope.DIRECT_REPORTS]: 2,
      [PermissionScope.ORG_UNIT]: 3,
      [PermissionScope.ORG_SUBTREE]: 4,
      [PermissionScope.ORGANIZATION]: 5,
      [PermissionScope.ASSIGNED]: 2,
      [PermissionScope.GLOBAL]: 6,
    };

    // A broader organizational scope can satisfy a narrower requirement.
    // ASSIGNED is intentionally not treated as a hierarchy because it is
    // assignment-specific rather than geographically/organizationally broad.
    if (actual === PermissionScope.ASSIGNED || required === PermissionScope.ASSIGNED) return false;
    return rank[actual] >= rank[required];
  }

  canActivate(context: ExecutionContext): boolean {
    const requirement = this.reflector.getAllAndOverride<Requirement | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const allowed = request.user.roles.some((role) =>
      role.permissions.some((permission) =>
        permission.code === requirement.code && (!requirement.scope || this.scopeAllows(permission.scope as PermissionScope, requirement.scope)),
      ),
    );

    if (!allowed) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

import { SetMetadata } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';

export const PERMISSION_KEY = 'pms_permission';
export const RequirePermission = (code: string, scope?: PermissionScope) =>
  SetMetadata(PERMISSION_KEY, { code, scope });

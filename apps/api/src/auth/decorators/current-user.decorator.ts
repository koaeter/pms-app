import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from '../types/auth-request';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => (ctx.switchToHttp().getRequest() as AuthRequest).user,
);

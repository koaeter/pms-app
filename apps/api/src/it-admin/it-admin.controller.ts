import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthRequest } from '../auth/types/auth-request';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ItAdminService } from './it-admin.service';

@Controller('admin/it')
@UseGuards(SessionGuard, PermissionGuard)
export class ItAdminController {
  constructor(private readonly service: ItAdminService) {}

  @Get('health')
  @RequirePermission('it.system.read')
  health() { return this.service.health(); }

  @Get('users')
  @RequirePermission('it.users.read')
  users(@CurrentUser() request: AuthRequest) { return this.service.listUsers(request.user.employee.organizationId); }

  @Get('users/:userId')
  @RequirePermission('it.users.read')
  user(@CurrentUser() request: AuthRequest, @Param('userId') userId: string) { return this.service.getUser(request.user.employee.organizationId, userId); }

  @Post('users/:userId/status')
  @RequirePermission('it.users.manage')
  setStatus(@CurrentUser() request: AuthRequest, @Param('userId') userId: string, @Body() dto: ChangeUserStatusDto) {
    return this.service.setUserStatus(request.user.employee.organizationId, userId, dto.status, request.user.id);
  }

  @Post('users/:userId/revoke-sessions')
  @RequirePermission('it.sessions.manage')
  revokeSessions(@CurrentUser() request: AuthRequest, @Param('userId') userId: string) {
    return this.service.revokeSessions(request.user.employee.organizationId, userId, request.user.id);
  }

  @Get('sessions')
  @RequirePermission('it.sessions.manage')
  sessions(@CurrentUser() request: AuthRequest, @Query('userId') userId?: string) {
    return this.service.listSessions(request.user.employee.organizationId, userId);
  }

  @Get('authentication-events')
  @RequirePermission('it.security.read')
  authenticationEvents(@CurrentUser() request: AuthRequest, @Query('userId') userId?: string) {
    return this.service.listAuthEvents(request.user.employee.organizationId, userId);
  }

  @Get('audit-logs')
  @RequirePermission('it.audit.read')
  auditLogs(@CurrentUser() request: AuthRequest) { return this.service.listAuditLogs(request.user.employee.organizationId); }
}

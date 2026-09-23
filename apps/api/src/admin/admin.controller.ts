import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  @RequirePermissions('users.read')
  users(@Req() request: { user: { permissions: string[] } }) { return this.service.listUsers(request.user); }

  @Post('users')
  @RequirePermissions('users.manage')
  createUser(@Req() request: { user: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null } }, @Body() body: { username: string; password: string; firstName: string; lastName: string; email?: string; provisioningOrganisationId?: string | null }) { return this.service.createUser(request.user, body); }

  @Post('users/:userId/link-employee/:employeeId')
  @RequirePermissions('users.manage')
  linkUserToEmployee(@Req() request: { user: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null } }, @Param('userId') userId: string, @Param('employeeId') employeeId: string) {
    return this.service.linkUserToEmployee(request.user, userId, employeeId);
  }

  @Post('employees/:employeeId/account')
  @RequirePermissions('users.manage')
  createAccountForEmployee(@Req() request: { user: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null } }, @Param('employeeId') employeeId: string, @Body() body: { username: string; password: string; firstName?: string; lastName?: string; email?: string }) {
    return this.service.createAccountForEmployee(request.user, employeeId, body);
  }

  @Post('users/:userId/status')
  @RequirePermissions('users.manage')
  setUserStatus(@Req() request: { user: { id: string; permissions: string[] } }, @Param('userId') userId: string, @Body() body: { isActive: boolean }) { return this.service.setUserStatus(request.user, userId, body.isActive); }

  @Get('roles')
  @RequirePermissions('roles.read')
  roles(@Req() request: { user: { permissions: string[] } }) { return this.service.listRoles(request.user); }

  @Post('users/:userId/roles')
  @RequirePermissions('roles.manage')
  assignRole(@Req() request: { user: { id: string; permissions: string[] } }, @Param('userId') userId: string, @Body() body: { roleId: string }) { return this.service.assignRole(request.user, userId, body.roleId); }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('roles.manage')
  removeRole(@Req() request: { user: { id: string; permissions: string[]; roles?: string[]; organisationId?: string | null } }, @Param('userId') userId: string, @Param('roleId') roleId: string) {
    return this.service.removeRole(request.user, userId, roleId);
  }

  @Get('audit')
  @RequirePermissions('audit.read')
  audit(@Req() request: { user: { permissions: string[]; roles?: string[]; organisationId?: string | null } }) { return this.service.listAudit(request.user); }
}

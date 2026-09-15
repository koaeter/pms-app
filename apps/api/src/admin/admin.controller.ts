import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  users(@Req() request: { user: { permissions: string[] } }) {
    return this.service.listUsers(request.user);
  }

  @Post('users')
  createUser(@Req() request: { user: { id: string; permissions: string[] } }, @Body() body: { username: string; password: string; firstName: string; lastName: string; email?: string }) {
    return this.service.createUser(request.user, body);
  }

  @Post('users/:userId/status')
  setUserStatus(@Req() request: { user: { id: string; permissions: string[] } }, @Param('userId') userId: string, @Body() body: { isActive: boolean }) {
    return this.service.setUserStatus(request.user, userId, body.isActive);
  }

  @Get('roles')
  roles(@Req() request: { user: { permissions: string[] } }) {
    return this.service.listRoles(request.user);
  }

  @Post('users/:userId/roles')
  assignRole(@Req() request: { user: { id: string; permissions: string[] } }, @Param('userId') userId: string, @Body() body: { roleId: string }) {
    return this.service.assignRole(request.user, userId, body.roleId);
  }

  @Get('audit')
  audit(@Req() request: { user: { permissions: string[] } }) {
    return this.service.listAudit(request.user);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { OrganisationService } from './organisation.service';

@Controller('organisation')
export class OrganisationController {
  constructor(private readonly service: OrganisationService) {}

  @Get()
  @RequirePermissions('organisation.read')
  organisations(@Req() request: { user: any }) { return this.service.listOrganisations(request.user); }

  @Post()
  @RequirePermissions('organisation.manage')
  createOrganisation(@Req() request: { user: any }, @Body() body: { name: string; code: string; description?: string }) { return this.service.createOrganisation(body, request.user); }

  @Patch(':organisationId')
  @RequirePermissions('organisation.manage')
  updateOrganisation(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { name?: string; code?: string; description?: string; isActive?: boolean }) { return this.service.updateOrganisation(organisationId, body, request.user); }

  @Get(':organisationId/departments')
  @RequirePermissions('organisation.read')
  departments(@Param('organisationId') organisationId: string, @Req() request: { user: any }) { return this.service.listDepartments(organisationId, request.user); }

  @Post(':organisationId/departments')
  @RequirePermissions('organisation.manage')
  createDepartment(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { name: string; code: string; parentId?: string }) { return this.service.createDepartment({ ...body, organisationId }, request.user); }

  @Patch('departments/:departmentId')
  @RequirePermissions('organisation.manage')
  updateDepartment(@Param('departmentId') departmentId: string, @Req() request: { user: any }, @Body() body: { name?: string; code?: string; parentId?: string | null }) { return this.service.updateDepartment(departmentId, body, request.user); }

  @Get(':organisationId/designations')
  @RequirePermissions('organisation.read')
  designations(@Param('organisationId') organisationId: string, @Req() request: { user: any }) { return this.service.listDesignations(organisationId, request.user); }

  @Post(':organisationId/designations')
  @RequirePermissions('organisation.manage')
  createDesignation(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { name: string; code?: string; grade?: string }) { return this.service.createDesignation({ ...body, organisationId }, request.user); }

  @Patch('designations/:designationId')
  @RequirePermissions('organisation.manage')
  updateDesignation(@Param('designationId') designationId: string, @Req() request: { user: any }, @Body() body: { name?: string; code?: string | null; grade?: string | null }) { return this.service.updateDesignation(designationId, body, request.user); }

  @Get(':organisationId/employees')
  @RequirePermissions('organisation.read')
  employees(@Param('organisationId') organisationId: string, @Req() request: { user: any }) { return this.service.listEmployees(organisationId, request.user); }

  @Post(':organisationId/employees')
  @RequirePermissions('users.manage')
  assignEmployee(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { userId: string; employeeNumber: string; departmentId?: string; designationId?: string; managerId?: string }) { return this.service.assignEmployee({ ...body, organisationId }, request.user); }

  @Post(':organisationId/employees/unlinked')
  @RequirePermissions('users.manage')
  createEmployee(@Param('organisationId') organisationId: string, @Req() request: { user: any }, @Body() body: { employeeNumber: string; departmentId?: string; designationId?: string; managerId?: string }) {
    return this.service.createEmployee({ ...body, organisationId }, request.user);
  }
}

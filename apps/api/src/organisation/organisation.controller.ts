import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/permissions.decorator';
import { OrganisationService } from './organisation.service';

@Controller('organisation')
export class OrganisationController {
  constructor(private readonly service: OrganisationService) {}

  @Get()
  @RequirePermissions('organisation.read')
  organisations() { return this.service.listOrganisations(); }

  @Post()
  @RequirePermissions('organisation.manage')
  createOrganisation(@Body() body: { name: string; code: string; description?: string }) { return this.service.createOrganisation(body); }

  @Patch(':organisationId')
  @RequirePermissions('organisation.manage')
  updateOrganisation(@Param('organisationId') organisationId: string, @Body() body: { name?: string; code?: string; description?: string; isActive?: boolean }) { return this.service.updateOrganisation(organisationId, body); }

  @Get(':organisationId/departments')
  @RequirePermissions('organisation.read')
  departments(@Param('organisationId') organisationId: string) { return this.service.listDepartments(organisationId); }

  @Post(':organisationId/departments')
  @RequirePermissions('organisation.manage')
  createDepartment(@Param('organisationId') organisationId: string, @Body() body: { name: string; code: string; parentId?: string }) { return this.service.createDepartment({ ...body, organisationId }); }

  @Patch('departments/:departmentId')
  @RequirePermissions('organisation.manage')
  updateDepartment(@Param('departmentId') departmentId: string, @Body() body: { name?: string; code?: string; parentId?: string | null }) { return this.service.updateDepartment(departmentId, body); }

  @Get(':organisationId/designations')
  @RequirePermissions('organisation.read')
  designations(@Param('organisationId') organisationId: string) { return this.service.listDesignations(organisationId); }

  @Post(':organisationId/designations')
  @RequirePermissions('organisation.manage')
  createDesignation(@Param('organisationId') organisationId: string, @Body() body: { name: string; code?: string; grade?: string }) { return this.service.createDesignation({ ...body, organisationId }); }

  @Patch('designations/:designationId')
  @RequirePermissions('organisation.manage')
  updateDesignation(@Param('designationId') designationId: string, @Body() body: { name?: string; code?: string | null; grade?: string | null }) { return this.service.updateDesignation(designationId, body); }

  @Get(':organisationId/employees')
  @RequirePermissions('organisation.read')
  employees(@Param('organisationId') organisationId: string) { return this.service.listEmployees(organisationId); }

  @Post(':organisationId/employees')
  @RequirePermissions('users.manage')
  assignEmployee(@Param('organisationId') organisationId: string, @Body() body: { userId: string; employeeNumber: string; departmentId?: string; designationId?: string; managerId?: string }) { return this.service.assignEmployee({ ...body, organisationId }); }
}

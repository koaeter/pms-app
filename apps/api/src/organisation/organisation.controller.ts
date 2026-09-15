import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrganisationService } from './organisation.service';

@Controller('organisation')
export class OrganisationController {
  constructor(private readonly service: OrganisationService) {}

  @Get()
  organisations() { return this.service.listOrganisations(); }

  @Post()
  createOrganisation(@Body() body: { name: string; code: string; description?: string }) { return this.service.createOrganisation(body); }

  @Get(':organisationId/departments')
  departments(@Param('organisationId') organisationId: string) { return this.service.listDepartments(organisationId); }

  @Post(':organisationId/departments')
  createDepartment(@Param('organisationId') organisationId: string, @Body() body: { name: string; code: string; parentId?: string }) { return this.service.createDepartment({ ...body, organisationId }); }

  @Get(':organisationId/designations')
  designations(@Param('organisationId') organisationId: string) { return this.service.listDesignations(organisationId); }

  @Post(':organisationId/designations')
  createDesignation(@Param('organisationId') organisationId: string, @Body() body: { name: string; code?: string; grade?: string }) { return this.service.createDesignation({ ...body, organisationId }); }

  @Get(':organisationId/employees')
  employees(@Param('organisationId') organisationId: string) { return this.service.listEmployees(organisationId); }

  @Post(':organisationId/employees')
  assignEmployee(@Param('organisationId') organisationId: string, @Body() body: { userId: string; employeeNumber: string; departmentId?: string; designationId?: string; managerId?: string }) { return this.service.assignEmployee({ ...body, organisationId }); }
}

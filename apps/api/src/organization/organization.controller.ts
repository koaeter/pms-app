import { Body, Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { SessionGuard } from '../auth/guards/session.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { AuthRequest } from '../auth/types/auth-request';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateUnitTypeDto } from './dto/create-unit-type.dto';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateReportingRelationshipDto } from './dto/create-reporting-relationship.dto';

@Controller('organizations')
@UseGuards(SessionGuard, PermissionGuard)
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}
  private organizationId(req: AuthRequest) { const id = req.user.employee?.organizationId; if (!id) throw new Error('Authenticated employee is not associated with an organization'); return id; }

  @Get()
  @RequirePermission('organization.read', PermissionScope.ORGANIZATION)
  list() { return this.organizations.list(); }

  @Post()
  @RequirePermission('organization.manage', PermissionScope.GLOBAL)
  create(@Body() dto: CreateOrganizationDto) { return this.organizations.create(dto); }

  @Get(':organizationId/units')
  @RequirePermission('organization.read', PermissionScope.ORGANIZATION)
  units(@Req() req: AuthRequest, @Param('organizationId') organizationId: string) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.units(organizationId); }

  @Post(':organizationId/units')
  @RequirePermission('organization.manage', PermissionScope.ORGANIZATION)
  createUnit(@Req() req: AuthRequest, @Param('organizationId') organizationId: string, @Body() dto: CreateUnitDto) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.createUnit(organizationId, dto); }

  @Get(':organizationId/unit-types')
  @RequirePermission('organization.read', PermissionScope.ORGANIZATION)
  unitTypes(@Req() req: AuthRequest, @Param('organizationId') organizationId: string) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.unitTypes(organizationId); }

  @Post(':organizationId/unit-types')
  @RequirePermission('organization.manage', PermissionScope.ORGANIZATION)
  createUnitType(@Req() req: AuthRequest, @Param('organizationId') organizationId: string, @Body() dto: CreateUnitTypeDto) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.createUnitType(organizationId, dto); }

  @Get(':organizationId/designations')
  @RequirePermission('organization.read', PermissionScope.ORGANIZATION)
  designations(@Req() req: AuthRequest, @Param('organizationId') organizationId: string) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.designations(organizationId); }

  @Post(':organizationId/designations')
  @RequirePermission('organization.manage', PermissionScope.ORGANIZATION)
  createDesignation(@Req() req: AuthRequest, @Param('organizationId') organizationId: string, @Body() dto: CreateDesignationDto) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.createDesignation(organizationId, dto); }

  @Get(':organizationId/assignments')
  @RequirePermission('employee.read', PermissionScope.ORGANIZATION)
  assignments(@Req() req: AuthRequest, @Param('organizationId') organizationId: string) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.assignments(organizationId); }

  @Post(':organizationId/assignments')
  @RequirePermission('employee.manage', PermissionScope.ORGANIZATION)
  createAssignment(@Req() req: AuthRequest, @Param('organizationId') organizationId: string, @Body() dto: CreateAssignmentDto) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.createAssignment(organizationId, dto); }

  @Get(':organizationId/reporting-relationships')
  @RequirePermission('employee.read', PermissionScope.ORGANIZATION)
  reporting(@Req() req: AuthRequest, @Param('organizationId') organizationId: string) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.reportingRelationships(organizationId); }

  @Post(':organizationId/reporting-relationships')
  @RequirePermission('employee.manage', PermissionScope.ORGANIZATION)
  createReporting(@Req() req: AuthRequest, @Param('organizationId') organizationId: string, @Body() dto: CreateReportingRelationshipDto) { if (this.organizationId(req) !== organizationId) throw new Error('Organization access denied'); return this.organizations.createReportingRelationship(organizationId, dto); }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionScope } from '@prisma/client';
import { SessionGuard } from '../auth/guards/session.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';

@Controller('organizations')
@UseGuards(SessionGuard, PermissionGuard)
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get()
  @RequirePermission('organization.read', PermissionScope.ORGANIZATION)
  list() { return this.organizations.list(); }

  @Post()
  @RequirePermission('organization.manage', PermissionScope.GLOBAL)
  create(@Body() dto: CreateOrganizationDto) { return this.organizations.create(dto); }

  @Get(':organizationId/units')
  @RequirePermission('organization.read', PermissionScope.ORGANIZATION)
  units(@Param('organizationId') organizationId: string) { return this.organizations.units(organizationId); }

  @Post(':organizationId/units')
  @RequirePermission('organization.manage', PermissionScope.ORGANIZATION)
  createUnit(@Param('organizationId') organizationId: string, @Body() dto: CreateUnitDto) { return this.organizations.createUnit(organizationId, dto); }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUnitDto } from './dto/create-unit.dto';

@Controller('organizations')
@UseGuards(SessionGuard)
export class OrganizationController {
  constructor(private readonly organizations: OrganizationService) {}

  @Get() list() { return this.organizations.list(); }
  @Post() create(@Body() dto: CreateOrganizationDto) { return this.organizations.create(dto); }
  @Get(':organizationId/units') units(@Param('organizationId') organizationId: string) { return this.organizations.units(organizationId); }
  @Post(':organizationId/units') createUnit(@Param('organizationId') organizationId: string, @Body() dto: CreateUnitDto) { return this.organizations.createUnit(organizationId, dto); }
}

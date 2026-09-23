import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { OrganisationService } from './organisation.service';
import { AuditService } from '../audit.service';

@Module({ controllers: [OrganisationController], providers: [OrganisationService, AuditService] })
export class OrganisationModule {}

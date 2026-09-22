import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';

@Module({ controllers: [AdminController], providers: [AdminService, PrismaService, AuditService] })
export class AdminModule {}

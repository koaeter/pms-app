import { Module } from '@nestjs/common';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { ItAdminController } from './it-admin.controller';
import { ItAdminService } from './it-admin.service';

@Module({
  controllers: [ItAdminController],
  providers: [ItAdminService, PermissionGuard],
})
export class ItAdminModule {}

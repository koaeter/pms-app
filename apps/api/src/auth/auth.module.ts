import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { PermissionGuard } from './permission.guard';

@Module({ controllers: [AuthController], providers: [AuthService, SessionGuard, PermissionGuard], exports: [AuthService, SessionGuard, PermissionGuard] })
export class AuthModule {}

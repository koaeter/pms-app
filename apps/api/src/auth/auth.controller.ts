import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './guards/session.guard';
import { AuthRequest } from './types/auth-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, request, response);
  }

  @UseGuards(SessionGuard)
  @Post('logout')
  logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response);
  }

  @UseGuards(SessionGuard)
  @Get('me')
  me(@Req() request: AuthRequest) {
    return this.authService.me(request);
  }
}

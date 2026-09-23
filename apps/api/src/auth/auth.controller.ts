import { Body, Controller, Get, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Bearer token required');
    return this.auth.logout(token);
  }

  @Post('password')
  changePassword(@Req() request: { user: { id: string } }, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.auth.changePassword(request.user.id, body.currentPassword, body.newPassword);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Bearer token required');
    return this.auth.currentUser(token);
  }
}

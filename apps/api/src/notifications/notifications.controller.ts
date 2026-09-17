import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@Req() request: { user: { id: string } }) { return this.service.listForUser(request.user.id); }

  @Get('unread-count')
  unreadCount(@Req() request: { user: { id: string } }) { return this.service.unreadCount(request.user.id); }

  @Post(':id/read')
  markRead(@Req() request: { user: { id: string } }, @Param('id') id: string) { return this.service.markRead(request.user.id, id); }

  @Post('read-all')
  markAllRead(@Req() request: { user: { id: string } }) { return this.service.markAllRead(request.user.id); }
}

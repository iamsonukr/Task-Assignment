import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthUser, CurrentUser, JwtAuthGuard, ObjectIdPipe } from '../common/decorators';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() async list(@CurrentUser() me: AuthUser) {
    const [items, unread] = await Promise.all([this.svc.list(me.id), this.svc.unreadCount(me.id)]);
    return { items, unread };
  }
  @Patch('read-all') async readAll(@CurrentUser() me: AuthUser) { await this.svc.markAllRead(me.id); return { ok: true }; }
  @Patch(':id/read') async read(@CurrentUser() me: AuthUser, @Param('id', ObjectIdPipe) id: string) { await this.svc.markRead(me.id, id); return { ok: true }; }
}

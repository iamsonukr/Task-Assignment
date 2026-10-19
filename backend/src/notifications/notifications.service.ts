import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './notification.schema';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from './mail.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private model: Model<NotificationDocument>,
    private gateway: NotificationsGateway, private mail: MailService, private users: UsersService,
  ) {}

  /** Honours the recipient's preferences (in-app / email / per-type mute). Never throws. */
  async notify(userId: string, type: NotificationType, message: string, taskId: string) {
    try {
      const u = await this.users.findById(userId);
      if (!u) return;
      const p = u.notificationPrefs ?? { inApp: true, email: false, muteAssigned: false, muteUpdated: false };
      if ((type === 'assigned' && p.muteAssigned) || (type === 'updated' && p.muteUpdated)) return;
      if (p.inApp) {
        const n = await this.model.create({ user: userId, type, message, task: taskId });
        this.gateway.emitToUser(userId, 'notification', n.toObject());
      }
      if (p.email) await this.mail.send(u.email, `TaskFlow: ${message}`, message);
    } catch { /* notifications are best-effort */ }
  }

  list(userId: string) { return this.model.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean(); }
  unreadCount(userId: string) { return this.model.countDocuments({ user: userId, read: false }); }
  markRead(userId: string, id: string) { return this.model.updateOne({ _id: id, user: userId }, { read: true }); }
  markAllRead(userId: string) { return this.model.updateMany({ user: userId, read: false }, { read: true }); }
}

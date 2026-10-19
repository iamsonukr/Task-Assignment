import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from './mail.service';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]), UsersModule],
  providers: [NotificationsService, NotificationsGateway, MailService],
  controllers: [NotificationsController], exports: [NotificationsService],
})
export class NotificationsModule {}

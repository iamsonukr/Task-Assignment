import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationType = 'assigned' | 'updated';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) user: Types.ObjectId;
  @Prop({ type: String, required: true }) type: NotificationType;
  @Prop({ required: true }) message: string;
  @Prop({ type: Types.ObjectId, ref: 'Task' }) task: Types.ObjectId;
  @Prop({ default: false }) read: boolean;
}
export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ user: 1, createdAt: -1 });

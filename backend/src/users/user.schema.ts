import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../common/roles';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, maxlength: 80 }) name: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, select: false }) passwordHash: string;
  @Prop({ type: String, enum: Role, default: Role.User }) role: Role;
  @Prop({
    type: { inApp: Boolean, email: Boolean, muteAssigned: Boolean, muteUpdated: Boolean },
    default: { inApp: true, email: false, muteAssigned: false, muteUpdated: false },
    _id: false,
  })
  notificationPrefs: { inApp: boolean; email: boolean; muteAssigned: boolean; muteUpdated: boolean };
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) actor: Types.ObjectId;
  @Prop({ required: true, index: true }) action: string;
  @Prop() entityType: string;
  @Prop() entityId: string;
  @Prop({ type: Object }) meta: Record<string, unknown>;
}
export type AuditDocument = HydratedDocument<AuditLog>;
export const AuditSchema = SchemaFactory.createForClass(AuditLog);
AuditSchema.index({ createdAt: -1 });

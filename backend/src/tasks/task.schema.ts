import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
export const RECURRENCES = ['none', 'daily', 'weekly', 'monthly'] as const;
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Recurrence = (typeof RECURRENCES)[number];

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true, trim: true, maxlength: 140 }) title: string;
  @Prop({ trim: true, maxlength: 4000, default: '' }) description: string;
  @Prop({ type: Date }) dueDate?: Date;
  @Prop({ type: String, enum: PRIORITIES, default: 'medium' }) priority: Priority;
  @Prop({ type: String, enum: STATUSES, default: 'todo' }) status: Status;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) createdBy: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) assignee?: Types.ObjectId;
  @Prop({ type: String, enum: RECURRENCES, default: 'none' }) recurrence: Recurrence;
  @Prop({ type: Date }) completedAt?: Date;
  /** The occurrence this task was spawned from (recurring tasks). */
  @Prop({ type: Types.ObjectId, ref: 'Task' }) recurrenceParent?: Types.ObjectId;
}
export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ status: 1, dueDate: 1 });
TaskSchema.index({ title: 'text', description: 'text' });

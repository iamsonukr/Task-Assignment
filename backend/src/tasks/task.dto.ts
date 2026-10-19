import { IsDateString, IsEnum, IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PRIORITIES, Priority, RECURRENCES, Recurrence, STATUSES, Status } from './task.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTaskDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(140) title: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
  @IsOptional() @IsIn(STATUSES) status?: Status;
  @IsOptional() @IsMongoId() assignee?: string;
  @IsOptional() @IsIn(RECURRENCES) recurrence?: Recurrence;
}

export class UpdateTaskDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(140) title?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) description?: string;
  /** null clears the due date */
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsDateString() dueDate?: string | null;
  @IsOptional() @IsIn(PRIORITIES) priority?: Priority;
  @IsOptional() @IsIn(STATUSES) status?: Status;
  /** null un-assigns */
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsMongoId() assignee?: string | null;
  @IsOptional() @IsIn(RECURRENCES) recurrence?: Recurrence;
}

export class QueryTasksDto {
  @IsOptional() @IsIn(['all', 'assigned', 'created']) scope?: 'all' | 'assigned' | 'created';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(STATUSES) status?: Status;
  @IsOptional() @IsEnum(PRIORITIES) priority?: Priority;
  @IsOptional() @IsDateString() dueFrom?: string;
  @IsOptional() @IsDateString() dueTo?: string;
  @IsOptional() @IsIn(['true', 'false']) overdue?: 'true' | 'false';
  @IsOptional() @IsIn(['dueDate', 'createdAt', 'priority']) sort?: 'dueDate' | 'createdAt' | 'priority';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

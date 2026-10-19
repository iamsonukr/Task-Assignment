import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({ imports: [TasksModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}

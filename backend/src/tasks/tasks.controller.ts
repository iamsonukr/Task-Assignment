import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, QueryTasksDto, UpdateTaskDto } from './task.dto';
import { AuthUser, CurrentUser, JwtAuthGuard, ObjectIdPipe } from '../common/decorators';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateTaskDto) { return this.tasks.create(u, dto); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: QueryTasksDto) { return this.tasks.list(u, q); }
  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser) { return this.tasks.dashboard(u); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.tasks.get(u, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string, @Body() dto: UpdateTaskDto) { return this.tasks.update(u, id, dto); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id', ObjectIdPipe) id: string) { return this.tasks.remove(u, id); }
}

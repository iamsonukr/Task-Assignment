import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from './task.schema';
import { CreateTaskDto, QueryTasksDto, UpdateTaskDto } from './task.dto';
import { AuthUser } from '../common/decorators';
import { isPrivileged } from '../common/roles';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildTaskFilter, canEditAll, canView, nextDueDate } from './task.utils';

const POPULATE = [{ path: 'createdBy', select: 'name email' }, { path: 'assignee', select: 'name email' }];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private model: Model<TaskDocument>,
    private users: UsersService, private audit: AuditService, private notifications: NotificationsService,
  ) {}

  private async assertAssignable(id?: string | null) {
    if (id && !(await this.users.findById(id))) throw new BadRequestException('Assignee does not exist');
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    if (dto.recurrence && dto.recurrence !== 'none' && !dto.dueDate)
      throw new BadRequestException('Recurring tasks need a due date');
    await this.assertAssignable(dto.assignee);
    const task = await this.model.create({
      ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, createdBy: user.id,
      completedAt: dto.status === 'done' ? new Date() : undefined,
    });
    await this.audit.log(user.id, 'task.created', 'task', task.id, { title: task.title, assignee: dto.assignee });
    if (dto.assignee && dto.assignee !== user.id)
      await this.notifications.notify(dto.assignee, 'assigned', `${user.name} assigned you "${task.title}"`, task.id);
    return this.get(user, task.id);
  }

  async get(user: AuthUser, id: string) {
    const t = await this.model.findById(id).populate(POPULATE).lean();
    // 404 (not 403) for tasks the user can't see, so ids can't be probed.
    if (!t || !canView(user, t)) throw new NotFoundException('Task not found');
    return t;
  }

  async list(user: AuthUser, q: QueryTasksDto) {
    const filter = buildTaskFilter(user, q);
    const page = q.page ?? 1, limit = q.limit ?? 20;
    const sort: Record<string, 1 | -1> =
      q.sort === 'createdAt' ? { createdAt: -1 } : q.sort === 'priority' ? { priority: 1, dueDate: 1 } : { dueDate: 1, createdAt: -1 };
    let items: any[];
    if (q.sort === 'priority') {
      // priority is a string enum, so rank it in memory after fetching the page window
      const all = await this.model.find(filter).populate(POPULATE).sort({ dueDate: 1 }).lean();
      all.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
      items = all.slice((page - 1) * limit, page * limit);
      return { items, total: all.length, page, limit };
    }
    const [rows, total] = await Promise.all([
      this.model.find(filter).populate(POPULATE).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return { items: rows, total, page, limit };
  }

  async dashboard(user: AuthUser) {
    const now = new Date();
    const me = new Types.ObjectId(user.id);
    const open = { status: { $ne: 'done' } };
    const q = (f: object) => this.model.find(f).populate(POPULATE).sort({ dueDate: 1 }).limit(10).lean();
    const [assigned, created, overdue, counts] = await Promise.all([
      q({ assignee: me, ...open }),
      q({ createdBy: me }),
      q({ $or: [{ assignee: me }, { createdBy: me }], dueDate: { $lt: now }, ...open }),
      this.model.aggregate([
        { $match: { $or: [{ assignee: me }, { createdBy: me }] } },
        { $group: { _id: null,
          assigned: { $sum: { $cond: [{ $and: [{ $eq: ['$assignee', me] }, { $ne: ['$status', 'done'] }] }, 1, 0] } },
          created: { $sum: { $cond: [{ $eq: ['$createdBy', me] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $eq: [{ $type: '$dueDate' }, 'date'] }, { $lt: ['$dueDate', now] }, { $ne: ['$status', 'done'] }] }, 1, 0] } } } },
      ]),
    ]);
    const c = counts[0] ?? { assigned: 0, created: 0, overdue: 0 };
    return { assigned, created, overdue, counts: { assigned: c.assigned, created: c.created, overdue: c.overdue } };
  }

  async update(user: AuthUser, id: string, dto: UpdateTaskDto) {
    const task = await this.model.findById(id).lean();
    if (!task || !canView(user, task)) throw new NotFoundException('Task not found');

    const full = canEditAll(user, task);
    // A mere assignee may only move the task through its workflow.
    const keys = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined);
    if (!full && keys.some((k) => k !== 'status'))
      throw new ForbiddenException('Assignees can only update the status of a task');
    if (dto.assignee) await this.assertAssignable(dto.assignee);

    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    for (const k of ['title', 'description', 'priority', 'status', 'recurrence'] as const)
      if (dto[k] !== undefined) set[k] = dto[k];
    if (dto.dueDate !== undefined) dto.dueDate === null ? (unset.dueDate = 1) : (set.dueDate = new Date(dto.dueDate));
    if (dto.assignee !== undefined) dto.assignee === null ? (unset.assignee = 1) : (set.assignee = dto.assignee);
    if (dto.status === 'done' && task.status !== 'done') set.completedAt = new Date();
    if (dto.status && dto.status !== 'done' && task.status === 'done') unset.completedAt = 1;

    const effRecurrence = (set.recurrence ?? task.recurrence) as string;
    const effDue = 'dueDate' in unset ? undefined : (set.dueDate as Date | undefined) ?? task.dueDate;
    if (effRecurrence !== 'none' && !effDue) throw new BadRequestException('Recurring tasks need a due date');

    // new:false returns the pre-update doc atomically, so concurrent "mark done" calls
    // can't both observe a not-done -> done transition and spawn duplicate occurrences.
    const before = await this.model.findOneAndUpdate(
      { _id: id }, { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) },
      { new: false, runValidators: true },
    ).lean();
    if (!before) throw new NotFoundException('Task not found');

    const justCompleted = dto.status === 'done' && before.status !== 'done';
    if (justCompleted && effRecurrence !== 'none')
      await this.spawnNext(before, { ...set, ...('assignee' in unset ? { assignee: undefined } : {}) }, effDue, effRecurrence as any);

    await this.audit.log(user.id, 'task.updated', 'task', id, { changes: dto as any });
    await this.notifyChanges(user, before, dto, (set.title as string) ?? before.title);
    return this.get(user, id);
  }

  private async spawnNext(before: any, set: Record<string, any>, due: Date | undefined, recurrence: 'daily' | 'weekly' | 'monthly') {
    const next = await this.model.create({
      title: set.title ?? before.title, description: set.description ?? before.description,
      priority: set.priority ?? before.priority, createdBy: before.createdBy,
      assignee: 'assignee' in set ? set.assignee : before.assignee, recurrence,
      dueDate: nextDueDate(due, recurrence), status: 'todo', recurrenceParent: before._id,
    });
    await this.audit.log(String(before.createdBy), 'task.recurred', 'task', next.id, { from: String(before._id) });
  }

  private async notifyChanges(user: AuthUser, before: any, dto: UpdateTaskDto, title: string) {
    const prevAssignee = before.assignee ? String(before.assignee) : undefined;
    const newAssignee = dto.assignee === undefined ? prevAssignee : dto.assignee ?? undefined;
    const notified = new Set<string>([user.id]);
    if (newAssignee && newAssignee !== prevAssignee && !notified.has(newAssignee)) {
      notified.add(newAssignee);
      await this.notifications.notify(newAssignee, 'assigned', `${user.name} assigned you "${title}"`, String(before._id));
    }
    const changed = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined && k !== 'assignee');
    if (!changed.length) return;
    for (const rid of [newAssignee, String(before.createdBy)])
      if (rid && !notified.has(rid)) {
        notified.add(rid);
        await this.notifications.notify(rid, 'updated', `${user.name} updated "${title}" (${changed.join(', ')})`, String(before._id));
      }
  }

  async remove(user: AuthUser, id: string) {
    const task = await this.model.findById(id).lean();
    if (!task || !canView(user, task)) throw new NotFoundException('Task not found');
    if (!canEditAll(user, task)) throw new ForbiddenException('Only the creator, a manager or an admin can delete this task');
    await this.model.deleteOne({ _id: id });
    await this.audit.log(user.id, 'task.deleted', 'task', id, { title: task.title });
    return { ok: true };
  }
}

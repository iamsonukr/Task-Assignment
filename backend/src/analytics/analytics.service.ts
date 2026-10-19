import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '../tasks/task.schema';
import { AuthUser } from '../common/decorators';
import { isPrivileged } from '../common/roles';

const DAYS = 14;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class AnalyticsService {
  constructor(@InjectModel(Task.name) private model: Model<TaskDocument>) {}

  /** Managers/admins see the whole team; regular users only see tasks they own or are assigned. */
  async summary(user: AuthUser) {
    const now = new Date();
    const me = new Types.ObjectId(user.id);
    const scope = isPrivileged(user.role) ? {} : { $or: [{ createdBy: me }, { assignee: me }] };
    const since = new Date(now.getTime() - (DAYS - 1) * 86_400_000);
    since.setUTCHours(0, 0, 0, 0);

    const [byStatus, byPriority, perUser, recent] = await Promise.all([
      this.model.aggregate([{ $match: scope }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      this.model.aggregate([{ $match: scope }, { $group: { _id: '$priority', n: { $sum: 1 } } }]),
      this.model.aggregate([
        { $match: { ...scope, assignee: { $exists: true } } },
        { $group: { _id: '$assignee',
          assigned: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', now] }, { $ne: ['$status', 'done'] }] }, 1, 0] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $project: { _id: 0, userId: '$_id', name: { $ifNull: [{ $arrayElemAt: ['$u.name', 0] }, 'Unknown'] }, assigned: 1, completed: 1, overdue: 1 } },
        { $sort: { completed: -1 } },
      ]),
      this.model.find({ ...scope, $or: [{ createdAt: { $gte: since } }, { completedAt: { $gte: since } }, { dueDate: { $gte: since, $lte: now } }] })
        .select('createdAt completedAt dueDate status').lean(),
    ]);

    // Daily buckets for the trend charts
    const trend = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(since.getTime() + i * 86_400_000);
      return { date: dayKey(d), created: 0, completed: 0, missedDeadline: 0 };
    });
    const idx = new Map(trend.map((t, i) => [t.date, i]));
    for (const t of recent as any[]) {
      const c = idx.get(dayKey(t.createdAt)); if (c !== undefined) trend[c].created++;
      if (t.completedAt) { const i = idx.get(dayKey(t.completedAt)); if (i !== undefined) trend[i].completed++; }
      if (t.dueDate) {
        const i = idx.get(dayKey(t.dueDate));
        const late = t.status !== 'done' ? t.dueDate < now : t.completedAt > t.dueDate;
        if (i !== undefined && late) trend[i].missedDeadline++;
      }
    }

    const status = Object.fromEntries(byStatus.map((s: any) => [s._id, s.n]));
    const total = Object.values(status).reduce((a: number, b: any) => a + b, 0) as number;
    const done = (status.done as number) ?? 0;
    const overdue = perUser.reduce((a: number, u: any) => a + u.overdue, 0);
    return {
      totals: { total, done, overdue, completionRate: total ? Math.round((done / total) * 1000) / 10 : 0 },
      byStatus: { todo: status.todo ?? 0, in_progress: status.in_progress ?? 0, done },
      byPriority: Object.fromEntries(byPriority.map((p: any) => [p._id, p.n])),
      perUser: isPrivileged(user.role) ? perUser : perUser.filter((u: any) => String(u.userId) === user.id),
      trend,
    };
  }
}

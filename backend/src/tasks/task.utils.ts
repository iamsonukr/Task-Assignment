import { Types } from 'mongoose';
import { Role, isPrivileged } from '../common/roles';
import { Recurrence } from './task.schema';
import { QueryTasksDto } from './task.dto';
import { AuthUser } from '../common/decorators';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Adds `months` calendar months, clamping to month-end (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * Next due date for a recurring task: advance by one interval at a time until the date is in
 * the future, so completing a task late doesn't spawn an instantly-overdue copy.
 */
export function nextDueDate(due: Date | undefined, recurrence: Recurrence, now = new Date()): Date {
  let next = due ? new Date(due.getTime()) : new Date(now.getTime());
  let i = 0;
  do {
    if (recurrence === 'daily') next = new Date(next.getTime() + 86_400_000);
    else if (recurrence === 'weekly') next = new Date(next.getTime() + 7 * 86_400_000);
    else next = addMonths(due ? new Date(due.getTime()) : next, ++i);
  } while (next.getTime() <= now.getTime() && i < 1000);
  return next;
}

export const canView = (u: AuthUser, t: { createdBy: any; assignee?: any }) =>
  isPrivileged(u.role) || String(t.createdBy?._id ?? t.createdBy) === u.id || String(t.assignee?._id ?? t.assignee) === u.id;
export const canEditAll = (u: AuthUser, t: { createdBy: any }) =>
  isPrivileged(u.role) || String(t.createdBy?._id ?? t.createdBy) === u.id;

/** Builds the Mongo filter for the task list. Visibility is enforced here, not in the client. */
export function buildTaskFilter(u: AuthUser, q: QueryTasksDto, now = new Date()): Record<string, any> {
  const me = new Types.ObjectId(u.id);
  const and: Record<string, any>[] = [];

  if (q.scope === 'assigned') and.push({ assignee: me });
  else if (q.scope === 'created') and.push({ createdBy: me });
  else if (!isPrivileged(u.role)) and.push({ $or: [{ createdBy: me }, { assignee: me }] });

  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }] });
  }
  if (q.status) and.push({ status: q.status });
  if (q.priority) and.push({ priority: q.priority });
  if (q.dueFrom || q.dueTo) {
    const r: Record<string, Date> = {};
    if (q.dueFrom) r.$gte = new Date(q.dueFrom);
    if (q.dueTo) r.$lte = new Date(q.dueTo);
    and.push({ dueDate: r });
  }
  if (q.overdue === 'true') and.push({ dueDate: { $lt: now }, status: { $ne: 'done' } });
  return and.length ? { $and: and } : {};
}

import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Role } from '../common/roles';

const chain = (v: any) => ({ lean: () => Promise.resolve(v), populate: () => ({ lean: () => Promise.resolve(v) }) });
const creator = { id: 'c1', email: 'c@x.io', name: 'Creator', role: Role.User };
const assignee = { id: 'a1', email: 'a@x.io', name: 'Assignee', role: Role.User };

function setup(task: any) {
  const model: any = {
    findById: jest.fn(() => chain(task)),
    findOneAndUpdate: jest.fn(() => ({ lean: () => Promise.resolve(task) })),
    create: jest.fn(async (d) => ({ ...d, id: 'new1' })),
    deleteOne: jest.fn(),
  };
  const users: any = { findById: jest.fn(async () => ({ id: 'a1' })) };
  const audit: any = { log: jest.fn() };
  const notifications: any = { notify: jest.fn() };
  return { svc: new TasksService(model, users, audit, notifications), model, users, audit, notifications };
}
const base = { _id: 't1', title: 'T', description: '', priority: 'low', status: 'todo', recurrence: 'none', createdBy: 'c1', assignee: 'a1' };

describe('TasksService', () => {
  it('keeps the next recurring occurrence unassigned when completing and clearing an assignee', async () => {
    const { svc, model } = setup({ ...base, recurrence: 'daily', dueDate: new Date() });
    await svc.update(creator, 't1', { status: 'done', assignee: null });
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ assignee: undefined, recurrenceParent: 't1' }));
  });
  it('hides tasks from unrelated users with 404', async () => {
    const { svc } = setup({ ...base, createdBy: 'zz', assignee: 'yy' });
    await expect(svc.get(creator, 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('assignee may change status but nothing else', async () => {
    const { svc, model } = setup(base);
    await expect(svc.update(assignee, 't1', { title: 'hacked' })).rejects.toBeInstanceOf(ForbiddenException);
    await svc.update(assignee, 't1', { status: 'in_progress' });
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('only creator/manager can delete', async () => {
    const { svc, model } = setup(base);
    await expect(svc.remove(assignee, 't1')).rejects.toBeInstanceOf(ForbiddenException);
    await svc.remove(creator, 't1');
    expect(model.deleteOne).toHaveBeenCalled();
  });

  it('notifies a new assignee on create and logs an audit entry', async () => {
    const { svc, notifications, audit } = setup(base);
    await svc.create(creator, { title: 'X', assignee: 'a1' });
    expect(notifications.notify).toHaveBeenCalledWith('a1', 'assigned', expect.stringContaining('assigned you'), 'new1');
    expect(audit.log).toHaveBeenCalledWith('c1', 'task.created', 'task', 'new1', expect.anything());
  });

  it('does not notify when assigning to yourself', async () => {
    const { svc, notifications } = setup(base);
    await svc.create(creator, { title: 'X', assignee: 'c1' });
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('rejects recurring tasks without a due date and unknown assignees', async () => {
    const { svc, users } = setup(base);
    await expect(svc.create(creator, { title: 'X', recurrence: 'daily' })).rejects.toBeInstanceOf(BadRequestException);
    users.findById.mockResolvedValueOnce(null);
    await expect(svc.create(creator, { title: 'X', assignee: 'ghost' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('spawns the next occurrence only on the todo -> done transition', async () => {
    const due = new Date(Date.now() + 86_400_000);
    const rec = { ...base, recurrence: 'daily', dueDate: due };
    const { svc, model } = setup(rec);
    await svc.update(creator, 't1', { status: 'done' });
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'todo', recurrenceParent: 't1' }));

    const already = setup({ ...rec, status: 'done' });
    await already.svc.update(creator, 't1', { status: 'done' });
    expect(already.model.create).not.toHaveBeenCalled();
  });
});

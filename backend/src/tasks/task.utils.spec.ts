import { addMonths, buildTaskFilter, nextDueDate, canEditAll, canView } from './task.utils';
import { Role } from '../common/roles';

const oid = '507f1f77bcf86cd799439011';
const user = { id: oid, email: 'a@b.c', name: 'A', role: Role.User };
const manager = { ...user, role: Role.Manager };

describe('addMonths', () => {
  it('clamps to month end', () => {
    expect(addMonths(new Date('2025-01-31T10:00:00Z'), 1).toISOString()).toBe('2025-02-28T10:00:00.000Z');
    expect(addMonths(new Date('2024-01-31T10:00:00Z'), 1).toISOString()).toBe('2024-02-29T10:00:00.000Z');
  });
  it('rolls over years', () => {
    expect(addMonths(new Date('2025-12-15T00:00:00Z'), 1).toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });
});

describe('nextDueDate', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  it('adds one interval for future-due tasks', () => {
    expect(nextDueDate(new Date('2026-01-12T00:00:00Z'), 'daily', now).toISOString()).toBe('2026-01-13T00:00:00.000Z');
    expect(nextDueDate(new Date('2026-01-12T00:00:00Z'), 'weekly', now).toISOString()).toBe('2026-01-19T00:00:00.000Z');
  });
  it('skips missed occurrences so the copy is not born overdue', () => {
    expect(nextDueDate(new Date('2026-01-01T00:00:00Z'), 'daily', now).toISOString()).toBe('2026-01-11T00:00:00.000Z');
  });
  it('monthly keeps the original day-of-month when possible', () => {
    expect(nextDueDate(new Date('2025-10-31T00:00:00Z'), 'monthly', now).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('buildTaskFilter', () => {
  it('restricts regular users to tasks they created or are assigned', () => {
    const f = buildTaskFilter(user, {});
    expect(JSON.stringify(f)).toContain('createdBy');
    expect(JSON.stringify(f)).toContain('assignee');
  });
  it('lets managers see everything by default', () => {
    expect(buildTaskFilter(manager, {})).toEqual({});
  });
  it('escapes regex metacharacters in search', () => {
    const f = buildTaskFilter(manager, { search: '(.*)+' });
    const rx = f.$and[0].$or[0].title as RegExp;
    expect(rx.test('plain title')).toBe(false);
    expect(rx.test('a (.*)+ b')).toBe(true);
  });
  it('builds overdue and date-range filters', () => {
    const f = buildTaskFilter(manager, { overdue: 'true', dueFrom: '2026-01-01', dueTo: '2026-02-01' });
    expect(f.$and).toHaveLength(2);
  });
});

describe('permissions', () => {
  const task = { createdBy: 'other', assignee: oid };
  it('assignee can view but not fully edit', () => {
    expect(canView(user, task)).toBe(true);
    expect(canEditAll(user, task)).toBe(false);
  });
  it('strangers cannot view; managers can edit', () => {
    expect(canView(user, { createdBy: 'x', assignee: 'y' })).toBe(false);
    expect(canEditAll(manager, { createdBy: 'x' })).toBe(true);
  });
});

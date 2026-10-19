'use client';
import type { Task } from '@/lib/types';
import { useAuth } from '@/lib/auth';

const LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' } as const;
export const isOverdue = (t: Task) => !!t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();

export default function TaskItem({ task, onEdit, onDelete, onStatus }: { task: Task; onEdit: (t: Task) => void; onDelete: (t: Task) => void; onStatus: (t: Task, s: Task['status']) => void }) {
  const { user } = useAuth();
  const canDelete = user && (user.role !== 'user' || task.createdBy._id === user.id);
  const od = isOverdue(task);
  return (
    <article className={`task ${od ? 'overdue' : ''} ${task.status === 'done' ? 'done' : ''}`}>
      <div style={{ minWidth: 0 }}>
        <h3 onClick={() => onEdit(task)}>{task.title}</h3>
        {task.description && <div className="muted small" style={{ marginTop: 2, overflowWrap: 'anywhere' }}>{task.description.length > 140 ? task.description.slice(0, 140) + '…' : task.description}</div>}
        <div className="meta">
          <span className={`badge p-${task.priority}`}>{task.priority}</span>
          <span className={`badge s-${task.status}`}>{LABEL[task.status]}</span>
          {task.dueDate && <span style={od ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{od ? 'Overdue · ' : 'Due '}{new Date(task.dueDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>}
          {task.recurrence !== 'none' && <span>↻ {task.recurrence}</span>}
          <span>{task.assignee ? `→ ${task.assignee.name}` : 'Unassigned'}</span>
          <span>by {task.createdBy.name}</span>
        </div>
      </div>
      <div className="actions">
        {task.status !== 'done' && <button className="btn sm" onClick={() => onStatus(task, task.status === 'todo' ? 'in_progress' : 'done')}>{task.status === 'todo' ? 'Start' : 'Complete'}</button>}
        {task.status === 'done' && <button className="btn sm" onClick={() => onStatus(task, 'todo')}>Reopen</button>}
        <button className="btn sm" onClick={() => onEdit(task)}>Edit</button>
        {canDelete && <button className="btn sm danger" onClick={() => onDelete(task)}>Delete</button>}
      </div>
    </article>
  );
}

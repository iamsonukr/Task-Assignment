'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Task, UserRef } from '@/lib/types';

const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export default function TaskForm({ task, onClose, onSaved }: { task?: Task; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [f, setF] = useState({
    title: task?.title ?? '', description: task?.description ?? '', dueDate: toLocalInput(task?.dueDate),
    priority: task?.priority ?? 'medium', status: task?.status ?? 'todo', assignee: task?.assignee?._id ?? '', recurrence: task?.recurrence ?? 'none',
  });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  // An assignee who isn't the creator/manager can only change status (enforced server-side too).
  const statusOnly = !!task && user?.role === 'user' && task.createdBy._id !== user.id;
  useEffect(() => { api<UserRef[]>('GET', '/users').then((u) => setUsers(u.map((x: any) => ({ ...x, _id: x._id })))).catch(() => {}); }, []);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (f.recurrence !== 'none' && !f.dueDate) return setErr('Recurring tasks need a due date');
    setBusy(true);
    try {
      const body: any = statusOnly ? { status: f.status } : {
        title: f.title, description: f.description, priority: f.priority, status: f.status, recurrence: f.recurrence,
        dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : task ? null : undefined,
        assignee: f.assignee || (task ? null : undefined),
      };
      await api(task ? 'PATCH' : 'POST', task ? `/tasks/${task._id}` : '/tasks', body);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message || 'Something went wrong'); } finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" onSubmit={submit} aria-label={task ? 'Edit task' : 'New task'}>
        <h2 style={{ marginBottom: '1rem' }}>{task ? 'Edit task' : 'New task'}</h2>
        {err && <div className="err" role="alert">{err}</div>}
        {statusOnly && <p className="muted small">You&apos;re the assignee, so you can update the status only.</p>}
        <div className="field"><label htmlFor="title">Title</label><input id="title" required maxLength={140} disabled={statusOnly} value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></div>
        <div className="field"><label htmlFor="desc">Description</label><textarea id="desc" rows={3} maxLength={4000} disabled={statusOnly} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="row">
          <div className="field"><label htmlFor="due">Due date</label><input id="due" type="datetime-local" disabled={statusOnly} value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
          <div className="field"><label htmlFor="rec">Repeats</label>
            <select id="rec" disabled={statusOnly} value={f.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
              <option value="none">Never</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="pri">Priority</label>
            <select id="pri" disabled={statusOnly} value={f.priority} onChange={(e) => set('priority', e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
          <div className="field"><label htmlFor="st">Status</label>
            <select id="st" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div>
        </div>
        <div className="field"><label htmlFor="as">Assign to</label>
          <select id="as" disabled={statusOnly} value={f.assignee} onChange={(e) => set('assignee', e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}{u._id === user?.id ? ' (me)' : ''} — {u.email}</option>)}
          </select></div>
        <div className="actions" style={{ marginTop: '.5rem' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

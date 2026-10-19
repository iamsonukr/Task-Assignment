'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRefresh } from '@/lib/useRefresh';
import type { Task } from '@/lib/types';
import TaskItem from '@/components/TaskItem';
import TaskForm from '@/components/TaskForm';

interface Dash { assigned: Task[]; created: Task[]; overdue: Task[]; counts: { assigned: number; created: number; overdue: number } }

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState<Dash | null>(null);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api<Dash>('GET', '/tasks/dashboard').then((data) => { setD(data); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useRefresh(load);

  const status = async (t: Task, s: Task['status']) => {
    try { await api('PATCH', `/tasks/${t._id}`, { status: s }); await load(); }
    catch (e: any) { setErr(e.message); }
  };
  const del = async (t: Task) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await api('DELETE', `/tasks/${t._id}`); await load(); }
    catch (e: any) { setErr(e.message); }
  };

  const Section = ({ title, items, empty }: { title: string; items: Task[]; empty: string }) => (
    <section>
      <h2 style={{ marginBottom: '.6rem' }}>{title}</h2>
      <div className="tasks">
        {items.length === 0 && <p className="muted small">{empty}</p>}
        {items.map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} onDelete={del} onStatus={status} />)}
      </div>
    </section>
  );

  return (
    <>
      <div className="page-head">
        <div><h1>Hi, {user?.name.split(' ')[0]}</h1><span className="muted">Here&apos;s where things stand.</span></div>
        <button className="btn primary" onClick={() => setEditing('new')}>+ New task</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!d ? <p className="muted">Loading…</p> : (
        <div className="grid" style={{ gap: '1.5rem' }}>
          <div className="grid g4">
            <div className="card"><div className="muted small">Assigned to me (open)</div><div className="stat">{d.counts.assigned}</div></div>
            <div className="card"><div className="muted small">Created by me</div><div className="stat">{d.counts.created}</div></div>
            <div className="card"><div className="muted small">Overdue</div><div className="stat" style={d.counts.overdue ? { color: 'var(--danger)' } : undefined}>{d.counts.overdue}</div></div>
          </div>
          <Section title="Overdue" items={d.overdue} empty="Nothing overdue. 🎉" />
          <Section title="Assigned to me" items={d.assigned} empty="No open tasks assigned to you." />
          <Section title="Created by me" items={d.created} empty="You haven't created any tasks yet." />
        </div>
      )}
      {editing && <TaskForm task={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  );
}

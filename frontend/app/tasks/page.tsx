'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useRefresh } from '@/lib/useRefresh';
import type { Paged, Task } from '@/lib/types';
import TaskItem from '@/components/TaskItem';
import TaskForm from '@/components/TaskForm';

const LIMIT = 10;
const initial = { search: '', scope: 'all', status: '', priority: '', dueFrom: '', dueTo: '', overdue: '', sort: 'dueDate' };

export default function Tasks() {
  const [f, setF] = useState(initial);
  const [debounced, setDebounced] = useState(initial);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Task> | null>(null);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [err, setErr] = useState('');
  const reqId = useRef(0);

  // Debounce typing so we don't fire a request per keystroke; also reset to page 1 on any filter change.
  useEffect(() => { const t = setTimeout(() => { setDebounced(f); setPage(1); }, 300); return () => clearTimeout(t); }, [f]);

  const load = useCallback(async () => {
    const id = ++reqId.current; // ignore out-of-order responses
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    for (const [k, v] of Object.entries(debounced)) if (v) qs.set(k, k.startsWith('due') ? new Date(k === 'dueTo' ? v + 'T23:59:59' : v + 'T00:00:00').toISOString() : v);
    try { const r = await api<Paged<Task>>('GET', `/tasks?${qs}`); if (id === reqId.current) { setData(r); setErr(''); } }
    catch (e: any) { if (id === reqId.current) setErr(e.message); }
  }, [debounced, page]);
  useEffect(() => { load(); }, [load]);
  useRefresh(load);

  const status = async (t: Task, s: Task['status']) => { await api('PATCH', `/tasks/${t._id}`, { status: s }); load(); };
  const del = async (t: Task) => { if (confirm(`Delete "${t.title}"?`)) { await api('DELETE', `/tasks/${t._id}`); load(); } };
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  return (
    <>
      <div className="page-head">
        <div><h1>Tasks</h1><span className="muted">{data ? `${data.total} result${data.total === 1 ? '' : 's'}` : ' '}</span></div>
        <button className="btn primary" onClick={() => setEditing('new')}>+ New task</button>
      </div>
      <div className="filters" role="search">
        <input aria-label="Search" placeholder="Search title or description…" value={f.search} onChange={(e) => set('search', e.target.value)} maxLength={100} />
        <select aria-label="Scope" value={f.scope} onChange={(e) => set('scope', e.target.value)}><option value="all">All visible</option><option value="assigned">Assigned to me</option><option value="created">Created by me</option></select>
        <select aria-label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">Any status</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
        <select aria-label="Priority" value={f.priority} onChange={(e) => set('priority', e.target.value)}><option value="">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
        <input aria-label="Due from" type="date" value={f.dueFrom} onChange={(e) => set('dueFrom', e.target.value)} />
        <input aria-label="Due to" type="date" value={f.dueTo} min={f.dueFrom || undefined} onChange={(e) => set('dueTo', e.target.value)} />
        <select aria-label="Overdue" value={f.overdue} onChange={(e) => set('overdue', e.target.value)}><option value="">Overdue: any</option><option value="true">Overdue only</option></select>
        <select aria-label="Sort" value={f.sort} onChange={(e) => set('sort', e.target.value)}><option value="dueDate">Sort: due date</option><option value="priority">Sort: priority</option><option value="createdAt">Sort: newest</option></select>
        {dirty && <button className="btn" onClick={() => setF(initial)}>Clear</button>}
      </div>
      {err && <div className="err">{err}</div>}
      <div className="tasks">
        {data?.items.map((t) => <TaskItem key={t._id} task={t} onEdit={setEditing} onDelete={del} onStatus={status} />)}
        {data && data.items.length === 0 && <div className="card muted" style={{ textAlign: 'center' }}>{dirty ? 'No tasks match these filters.' : 'No tasks yet — create your first one.'}</div>}
        {!data && !err && <p className="muted">Loading…</p>}
      </div>
      {pages > 1 && (
        <div className="pager">
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="small muted">Page {page} of {pages}</span>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
      {editing && <TaskForm task={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  );
}

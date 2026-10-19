'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Role, UserRef } from '@/lib/types';

interface Log { _id: string; action: string; entityType?: string; entityId?: string; createdAt: string; actor?: { name: string; email: string }; meta?: Record<string, unknown> }

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [logs, setLogs] = useState<{ items: Log[]; total: number; page: number; limit: number } | null>(null);
  const [page, setPage] = useState(1); const [err, setErr] = useState('');
  const loadLogs = useCallback(() => api('GET', `/audit?page=${page}`).then(setLogs).catch((e) => setErr(e.message)), [page]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { api<UserRef[]>('GET', '/users').then(setUsers).catch(() => {}); }, []);

  async function setRole(id: string, role: Role) {
    setErr('');
    try { await api('PATCH', `/users/${id}/role`, { role }); setUsers((u) => u.map((x) => (x._id === id ? { ...x, role } : x))); loadLogs(); }
    catch (e: any) { setErr(e.message); }
  }
  const isAdmin = user?.role === 'admin';
  const pages = logs ? Math.max(1, Math.ceil(logs.total / logs.limit)) : 1;
  return (
    <>
      <div className="page-head"><div><h1>{isAdmin ? 'Admin' : 'Audit log'}</h1><span className="muted">{isAdmin ? 'Roles and activity' : 'Team activity'}</span></div></div>
      {err && <div className="err">{err}</div>}
      {isAdmin && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ marginBottom: '.5rem' }}>Users &amp; roles</h2>
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
            {users.map((u) => (
              <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td>
                <select aria-label={`Role for ${u.name}`} value={u.role} disabled={u._id === user?.id} onChange={(e) => setRole(u._id, e.target.value as Role)} style={{ width: 'auto' }}>
                  <option value="user">User</option><option value="manager">Manager</option><option value="admin">Admin</option>
                </select></td></tr>
            ))}</tbody></table></div>
          <p className="small muted">Admins: everything · Managers: see/edit all tasks, team analytics, audit log · Users: own tasks only.</p>
        </div>
      )}
      <div className="card">
        <h2 style={{ marginBottom: '.5rem' }}>Audit log</h2>
        <div className="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>
          {logs?.items.map((l) => (
            <tr key={l._id}><td className="small">{new Date(l.createdAt).toLocaleString()}</td><td>{l.actor?.name ?? '—'}</td><td><code>{l.action}</code></td>
              <td className="small muted" style={{ overflowWrap: 'anywhere' }}>{l.meta ? JSON.stringify(l.meta).slice(0, 120) : ''}</td></tr>
          ))}</tbody></table></div>
        {logs && logs.items.length === 0 && <p className="muted small">No activity yet.</p>}
        {pages > 1 && <div className="pager"><button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button><span className="small muted">Page {page} of {pages}</span><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button></div>}
      </div>
    </>
  );
}

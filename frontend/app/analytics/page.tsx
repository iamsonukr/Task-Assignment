'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface A {
  totals: { total: number; done: number; overdue: number; completionRate: number };
  byStatus: Record<string, number>; byPriority: Record<string, number>;
  perUser: { userId: string; name: string; assigned: number; completed: number; overdue: number }[];
  trend: { date: string; created: number; completed: number; missedDeadline: number }[];
}
const C = { a: '#1f6fb2', b: '#1f8a5b', c: '#c0392b' };

export default function Analytics() {
  const { user } = useAuth();
  const [a, setA] = useState<A | null>(null); const [err, setErr] = useState('');
  useEffect(() => { api<A>('GET', '/analytics').then(setA).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="err">{err}</div>;
  if (!a) return <p className="muted">Loading…</p>;
  const short = (d: string) => d.slice(5);
  return (
    <>
      <div className="page-head"><div><h1>Analytics</h1><span className="muted">{user?.role === 'user' ? 'Your tasks' : 'Whole team'} · last 14 days for trends</span></div></div>
      <div className="grid g4" style={{ marginBottom: '1rem' }}>
        <div className="card"><div className="muted small">Total tasks</div><div className="stat">{a.totals.total}</div></div>
        <div className="card"><div className="muted small">Completed</div><div className="stat">{a.totals.done}</div></div>
        <div className="card"><div className="muted small">Completion rate</div><div className="stat">{a.totals.completionRate}%</div></div>
        <div className="card"><div className="muted small">Overdue now</div><div className="stat" style={a.totals.overdue ? { color: 'var(--danger)' } : undefined}>{a.totals.overdue}</div></div>
      </div>
      <div className="grid g3">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Created vs completed</h2>
          <div style={{ height: 240 }}><ResponsiveContainer><LineChart data={a.trend.map((t) => ({ ...t, date: short(t.date) }))}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend />
            <Line type="monotone" dataKey="created" stroke={C.a} strokeWidth={2} dot={false} /><Line type="monotone" dataKey="completed" stroke={C.b} strokeWidth={2} dot={false} />
          </LineChart></ResponsiveContainer></div>
        </div>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>Overdue trend <span className="muted small">(tasks whose deadline fell on that day and weren&apos;t met)</span></h2>
          <div style={{ height: 220 }}><ResponsiveContainer><BarChart data={a.trend.map((t) => ({ ...t, date: short(t.date) }))}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="date" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
            <Bar dataKey="missedDeadline" name="Missed deadline" fill={C.c} radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <h2 style={{ marginBottom: '.5rem' }}>Completed tasks per user</h2>
        {a.perUser.length === 0 ? <p className="muted small">No assigned tasks yet.</p> : (
          <div className="table-wrap"><table><thead><tr><th>User</th><th>Assigned</th><th>Completed</th><th>Rate</th><th>Overdue</th></tr></thead>
            <tbody>{a.perUser.map((u) => (
              <tr key={u.userId}><td>{u.name}</td><td>{u.assigned}</td><td>{u.completed}</td><td>{u.assigned ? Math.round((u.completed / u.assigned) * 100) : 0}%</td><td style={u.overdue ? { color: 'var(--danger)' } : undefined}>{u.overdue}</td></tr>
            ))}</tbody></table></div>
        )}
        <div className="small muted" style={{ marginTop: '.75rem' }}>By status — To do: {a.byStatus.todo} · In progress: {a.byStatus.in_progress} · Done: {a.byStatus.done} &nbsp;|&nbsp; By priority — High: {a.byPriority.high ?? 0} · Medium: {a.byPriority.medium ?? 0} · Low: {a.byPriority.low ?? 0}</div>
      </div>
    </>
  );
}

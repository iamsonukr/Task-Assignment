'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Prefs } from '@/lib/types';

const defaults: Prefs = { inApp: true, email: false, muteAssigned: false, muteUpdated: false };
const rows: [keyof Prefs, string, string][] = [
  ['inApp', 'In-app notifications', 'Show alerts in the bell menu and as live pop-ups.'],
  ['email', 'Email notifications', 'Also send an email for each notification.'],
  ['muteAssigned', 'Mute “assigned to you”', 'Stop notifications when someone assigns you a task.'],
  ['muteUpdated', 'Mute “task updated”', 'Stop notifications when a task you own or are assigned is edited.'],
];

export default function Settings() {
  const { user, refresh } = useAuth();
  const [p, setP] = useState<Prefs>({ ...defaults, ...user?.notificationPrefs });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function toggle(k: keyof Prefs) {
    if (busy) return;
    setBusy(true);
    const next = { ...p, [k]: !p[k] }; setP(next);
    try { await api('PATCH', '/users/me/preferences', { [k]: next[k] }); await refresh(); setMsg('Saved'); }
    catch (e: any) { setP(p); setMsg(e.message); }
    finally { setBusy(false); }
    setTimeout(() => setMsg(''), 2000);
  }
  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><span className="muted">Notification preferences</span></div><span className="small muted" role="status">{msg}</span></div>
      <div className="card">
        {rows.map(([k, title, desc]) => (
          <label key={k} style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', padding: '.6rem 0', borderBottom: '1px solid var(--line)', color: 'var(--ink)', fontSize: '1rem', cursor: 'pointer' }}>
            <input type="checkbox" disabled={busy} style={{ width: 18, height: 18, marginTop: 3 }} checked={p[k]} onChange={() => toggle(k)} />
            <span><strong>{title}</strong><br /><span className="muted small">{desc}</span></span>
          </label>
        ))}
      </div>
    </>
  );
}

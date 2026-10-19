'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { flushQueue, queuedCount } from '@/lib/api';
import NotificationBell from './NotificationBell';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {});
    setOnline(navigator.onLine); setPending(queuedCount());
    const sync = async () => {
      setOnline(true);
      const n = await flushQueue();
      setPending(queuedCount());
      if (n) { setToast(`Synced ${n} offline change${n > 1 ? 's' : ''}`); window.dispatchEvent(new Event('taskflow:refresh')); setTimeout(() => setToast(''), 4000); }
    };
    const off = () => setOnline(false);
    const q = () => setPending(queuedCount());
    window.addEventListener('online', sync); window.addEventListener('offline', off); window.addEventListener('taskflow:queued', q);
    if (navigator.onLine && queuedCount()) sync();
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', off); window.removeEventListener('taskflow:queued', q); };
  }, []);

  if (['/login', '/register'].includes(path)) return <>{children}</>;
  if (loading || !user) return <p className="muted" style={{ padding: '2rem' }}>Loading…</p>;

  const links = [['/', 'Dashboard'], ['/tasks', 'Tasks'], ['/analytics', 'Analytics'], ...(user.role !== 'user' ? [['/admin', user.role === 'admin' ? 'Admin' : 'Audit log']] : []), ['/settings', 'Settings']];
  return (
    <div className="shell">
      {!online && <div className="banner">You&apos;re offline — changes to tasks are saved locally and will sync when you reconnect.</div>}
      {online && pending > 0 && <div className="banner">Syncing {pending} offline change(s)…</div>}
      <header className="topbar">
        <Link href="/" className="brand">TaskFlow</Link>
        <nav className="nav" aria-label="Main">
          {links.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>)}
        </nav>
        <NotificationBell />
        <span className="small muted" title={user.email}>{user.name} · {user.role}</span>
        <button className="btn sm" onClick={logout}>Log out</button>
      </header>
      <main className="main">{children}</main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

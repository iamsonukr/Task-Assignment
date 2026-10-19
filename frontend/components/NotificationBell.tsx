'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try { const r = await api<{ items: Notification[]; unread: number }>('GET', '/notifications'); setItems(r.items); setUnread(r.unread); } catch {}
  }, []);

  useEffect(() => {
    load();
    let socket: Socket | undefined; let cancelled = false;
    (async () => {
      try {
        // Short-lived, socket-only token: the session cookie is HttpOnly so JS can't read it, and the API host may differ.
        const { token } = await api<{ token: string }>('GET', '/auth/socket-token');
        if (cancelled) return;
        socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', { auth: { token }, transports: ['websocket', 'polling'] });
        socket.on('notification', (n: Notification) => {
          setItems((p) => [n, ...p]); setUnread((u) => u + 1); setToast(n.message); setTimeout(() => setToast(''), 5000);
          window.dispatchEvent(new Event('taskflow:refresh')); // live-update any open task list / dashboard
        });
      } catch {}
    })();
    const t = setInterval(load, 60_000); // fallback if the socket is blocked
    return () => { cancelled = true; socket?.disconnect(); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);

  const readAll = async () => { await api('PATCH', '/notifications/read-all'); setItems((p) => p.map((n) => ({ ...n, read: true }))); setUnread(0); };
  const readOne = async (n: Notification) => {
    if (n.read) return; await api('PATCH', `/notifications/${n._id}/read`);
    setItems((p) => p.map((x) => (x._id === n._id ? { ...x, read: true } : x))); setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div className="bell" ref={ref}>
      <button className="btn sm" aria-label={`Notifications, ${unread} unread`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>🔔{unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}</button>
      {open && (
        <div className="card pop" role="dialog" aria-label="Notifications">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Notifications</h2>
            {unread > 0 && <button className="btn sm" onClick={readAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <p className="muted small">Nothing yet.</p>}
          {items.map((n) => (
            <div key={n._id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => readOne(n)}>
              {n.message}<div className="muted small">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      {toast && <div className="toast" role="status">🔔 {toast}</div>}
    </div>
  );
}

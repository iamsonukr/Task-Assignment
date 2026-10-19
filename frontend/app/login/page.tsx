'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

export default function Login() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { setUser(await api<User>('POST', '/auth/login', { email, password })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <form className="auth card" onSubmit={submit}>
      <h1>Log in</h1><p className="muted">Welcome back to TaskFlow.</p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
      <p className="small muted">No account? <Link href="/register">Create one</Link></p>
    </form>
  );
}

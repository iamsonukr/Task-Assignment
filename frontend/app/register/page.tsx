'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

export default function Register() {
  const { setUser } = useAuth();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { setUser(await api<User>('POST', '/auth/register', f)); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <form className="auth card" onSubmit={submit}>
      <h1>Create account</h1><p className="muted">The first account becomes the admin.</p>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="field"><label htmlFor="n">Name</label><input id="n" required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="e">Email</label><input id="e" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><div className="small muted">8+ characters with a letter and a number.</div></div>
      <button className="btn primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      <p className="small muted">Already registered? <Link href="/login">Log in</Link></p>
    </form>
  );
}

'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiError } from './api';
import type { User } from './types';

interface Ctx { user: User | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void>; setUser: (u: User | null) => void }
const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);
const PUBLIC = ['/login', '/register'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); const path = usePathname();

  const refresh = useCallback(async () => {
    try { setUser(await api<User>('GET', '/auth/me')); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setUser(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (loading) return;
    if (!user && !PUBLIC.includes(path)) router.replace('/login');
    if (user && PUBLIC.includes(path)) router.replace('/');
  }, [user, loading, path, router]);

  const logout = useCallback(async () => { await api('POST', '/auth/logout'); setUser(null); router.replace('/login'); }, [router]);
  return <AuthCtx.Provider value={{ user, loading, refresh, logout, setUser }}>{children}</AuthCtx.Provider>;
}

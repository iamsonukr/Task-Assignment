'use client';
import { useEffect } from 'react';
/** Re-runs `fn` when a socket notification or an offline sync fires 'taskflow:refresh'. */
export function useRefresh(fn: () => void) {
  useEffect(() => { window.addEventListener('taskflow:refresh', fn); return () => window.removeEventListener('taskflow:refresh', fn); }, [fn]);
}

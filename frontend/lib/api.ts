'use client';
/** Thin fetch wrapper + a tiny offline queue for task mutations (PWA sync-when-back-online). */
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const QUEUE_KEY = 'taskflow.offlineQueue';
type Queued = { method: string; path: string; body?: unknown };

const readQueue = (): Queued[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
const writeQueue = (q: Queued[]) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {} };
export const queuedCount = () => (typeof window === 'undefined' ? 0 : readQueue().length);

async function raw(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m.join(', ') : m || res.statusText);
  }
  return data;
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const mutating = method !== 'GET';
  if (mutating && typeof navigator !== 'undefined' && !navigator.onLine && path.startsWith('/tasks')) {
    writeQueue([...readQueue(), { method, path, body }]);
    window.dispatchEvent(new Event('taskflow:queued'));
    return { queued: true } as T;
  }
  try { return await raw(method, path, body); }
  catch (e) {
    // Network failure (not an HTTP error): queue task mutations to replay later.
    if (mutating && path.startsWith('/tasks') && e instanceof TypeError) {
      writeQueue([...readQueue(), { method, path, body }]);
      window.dispatchEvent(new Event('taskflow:queued'));
      return { queued: true } as T;
    }
    throw e;
  }
}

/** Replays queued mutations in order; drops ones the server rejects (e.g. deleted/forbidden) so they can't block the queue. */
export async function flushQueue() {
  const q = readQueue(); if (!q.length) return 0;
  const rest: Queued[] = []; let done = 0;
  for (let i = 0; i < q.length; i++) {
    try { await raw(q[i].method, q[i].path, q[i].body); done++; }
    catch (e) { if (e instanceof TypeError) { rest.push(...q.slice(i)); break; } }
  }
  writeQueue(rest);
  window.dispatchEvent(new Event('taskflow:queued'));
  return done;
}

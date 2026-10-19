'use client';
/** Thin fetch wrapper + a tiny offline queue for task mutations (PWA sync-when-back-online). */
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

const QUEUE_KEY = 'taskflow.offlineQueue';
type Queued = { id: string; method: string; path: string; body?: unknown };
let queueUser: string | null = null;
let flushing: Promise<number> | null = null;
export function setQueueUser(userId: string | null) {
  queueUser = userId;
  // The old shared queue cannot be attributed safely to an account.
  try { localStorage.removeItem(QUEUE_KEY); } catch {}
}
const queueKey = () => queueUser ? `${QUEUE_KEY}.${queueUser}` : null;

const readQueue = (key = queueKey()): Queued[] => {
  try { const data = JSON.parse(key ? localStorage.getItem(key) || '[]' : '[]'); return Array.isArray(data) ? data : []; } catch { return []; }
};
const writeQueue = (key: string, q: Queued[]) => localStorage.setItem(key, JSON.stringify(q));
function enqueue(method: string, path: string, body?: unknown) {
  const key = queueKey();
  if (!key) throw new Error('Sign in before saving offline changes.');
  try { writeQueue(key, [...readQueue(key), { id: crypto.randomUUID(), method, path, body }]); }
  catch { throw new Error('Could not save this change offline. Browser storage is unavailable or full.'); }
  window.dispatchEvent(new Event('taskflow:queued'));
  return { queued: true };
}
export const queuedCount = () => (typeof window === 'undefined' ? 0 : readQueue().length);

async function raw(method: string, path: string, body?: unknown) {
  const res = await fetch(`/api${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
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
    return enqueue(method, path, body) as T;
  }
  try { return await raw(method, path, body); }
  catch (e) {
    // Network failure (not an HTTP error): queue task mutations to replay later.
    if (mutating && path.startsWith('/tasks') && e instanceof TypeError) {
      return enqueue(method, path, body) as T;
    }
    throw e;
  }
}

/** Replays queued mutations in order; drops ones the server rejects (e.g. deleted/forbidden) so they can't block the queue. */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  const key = queueKey();
  if (!key) return Promise.resolve(0);
  flushing = (async () => {
    let done = 0;
    for (const item of readQueue(key)) {
      if (queueKey() !== key) break;
      try { await raw(item.method, item.path, item.body); done++; }
      catch (e) {
        // Preserve transient failures and expired sessions for a later retry.
        if (!(e instanceof ApiError) || e.status >= 500 || [401, 408, 429].includes(e.status)) break;
      }
      // Remove only the processed entry; keep changes queued while this request ran.
      writeQueue(key, readQueue(key).filter((entry) => entry.id !== item.id));
    }
    window.dispatchEvent(new Event('taskflow:queued'));
    return done;
  })().finally(() => { flushing = null; });
  return flushing;
}

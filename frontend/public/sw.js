/* TaskFlow service worker: app-shell + static assets caching.
   Mutations are NOT handled here — the app queues them in localStorage and replays on reconnect (lib/api.ts). */
const STATIC = 'taskflow-static-v2';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('taskflow-') && k !== STATIC) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Private responses must not be shared between accounts using this browser.
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith((async () => {
      const hit = await caches.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) await (await caches.open(STATIC)).put(req, res.clone()); return res;
    })());
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { const res = await fetch(req); if (res.ok && !res.redirected) await (await caches.open(STATIC)).put(req, res.clone()); return res; }
      catch { return (await caches.match(req)) || (await caches.match('/')) || new Response('Offline', { status: 503 }); }
    })());
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('API rewrites have one slash regardless of trailing slashes in BACKEND_URL', async () => {
  const previous = process.env.BACKEND_URL;
  try {
    for (const suffix of ['', '/', '/// ']) {
      process.env.BACKEND_URL = `https://example.com${suffix}`;
      const { default: config } = await import(`../next.config.mjs?test=${crypto.randomUUID()}`);
      const [rewrite] = await config.rewrites();
      assert.equal(rewrite.destination, 'https://example.com/api/:path*');
    }
  } finally {
    if (previous === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = previous;
  }
});

test('service worker removes old private caches and leaves API requests on the network', async () => {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const removed = [];
  let claimed = false;
  runInNewContext(source, {
    URL,
    location: { origin: 'https://example.com' },
    self: {
      addEventListener: (name, callback) => { listeners[name] = callback; },
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => ['taskflow-api-v1', 'taskflow-static-v1', 'taskflow-static-v2', 'unrelated-app'],
      delete: async (key) => { removed.push(key); },
    },
  });
  let activated;
  listeners.activate({ waitUntil: (promise) => { activated = promise; } });
  await activated;
  assert.deepEqual(removed, ['taskflow-api-v1', 'taskflow-static-v1']);
  assert.equal(claimed, true);
  listeners.fetch({
    request: new Request('https://example.com/api/tasks'),
    respondWith: () => assert.fail('Private API response must not come from a shared offline cache'),
  });
});

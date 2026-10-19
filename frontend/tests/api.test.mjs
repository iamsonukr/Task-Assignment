import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../lib/api.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
let api;
let online;
beforeEach(async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = new EventTarget();
  online = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get onLine() { return online; } } });
  api = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}#${crypto.randomUUID()}`);
  api.setQueueUser('alice');
});

test('offline changes stay with their owner across login changes', async () => {
  await api.api('POST', '/tasks', { title: 'Alice task' });
  assert.equal(api.queuedCount(), 1);
  api.setQueueUser('bob');
  assert.equal(api.queuedCount(), 0);
  globalThis.fetch = async () => { throw new Error('must not send Alice changes'); };
  assert.equal(await api.flushQueue(), 0);
  api.setQueueUser('alice');
  assert.equal(api.queuedCount(), 1);
});

test('transient server errors retain queued changes for retry', async () => {
  await api.api('PATCH', '/tasks/one', { status: 'done' });
  globalThis.fetch = async () => Response.json({ message: 'Unavailable' }, { status: 503 });
  assert.equal(await api.flushQueue(), 0);
  assert.equal(api.queuedCount(), 1);
  globalThis.fetch = async () => Response.json({ ok: true });
  assert.equal(await api.flushQueue(), 1);
  assert.equal(api.queuedCount(), 0);
});

test('sync does not erase changes queued while a request is in flight', async () => {
  await api.api('PATCH', '/tasks/one', { status: 'done' });
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = () => resolve(Response.json({ ok: true })); });
  const syncing = api.flushQueue();
  assert.equal(api.flushQueue(), syncing);
  await api.api('POST', '/tasks', { title: 'Another task' });
  finish();
  assert.equal(await syncing, 1);
  assert.equal(api.queuedCount(), 1);
});

test('storage failure is shown instead of reporting a successful offline save', async () => {
  localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(api.api('POST', '/tasks', { title: 'Task' }), /Could not save this change offline/);
});

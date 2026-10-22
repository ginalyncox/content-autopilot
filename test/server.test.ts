import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { TemplateDrafter } from '../src/drafter.js';
import { createApp } from '../src/server.js';
import { MemoryStore } from '../src/store.js';

async function withServer(password: string | undefined, fn: (base: string) => Promise<void>) {
  const app = createApp({ store: new MemoryStore(), drafter: new TemplateDrafter(), publishers: [], adminPassword: password });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const auth = (pw: string) => ({ Authorization: `Basic ${Buffer.from(`gina:${pw}`).toString('base64')}` });

test('API is locked without ADMIN_PASSWORD', async () => {
  await withServer(undefined, async (base) => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/items`)).status, 503);
  });
});

test('API needs the right password, then plans a week', async () => {
  await withServer('secret', async (base) => {
    assert.equal((await fetch(`${base}/api/items`)).status, 401);
    assert.equal((await fetch(`${base}/api/items`, { headers: auth('wrong') })).status, 401);

    const plan = await fetch(`${base}/api/plan`, {
      method: 'POST',
      headers: { ...auth('secret'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: ['One', 'Two'] }),
    });
    assert.equal(plan.status, 200);
    const items = await (await fetch(`${base}/api/items`, { headers: auth('secret') })).json();
    assert.equal(items.length, 2);
    assert.ok(items[0].blockers.some((b: any) => b.id === 'placeholder'));
  });
});

test('approve screen is behind the password', async () => {
  await withServer('secret', async (base) => {
    assert.equal((await fetch(`${base}/`)).status, 401);
    const page = await fetch(`${base}/`, { headers: auth('secret') });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Needs your OK/);
  });
});

test('edit, approve, then take the approval back', async () => {
  await withServer('secret', async (base) => {
    const h = { ...auth('secret'), 'Content-Type': 'application/json' };
    const [draft] = await (
      await fetch(`${base}/api/plan`, { method: 'POST', headers: h, body: JSON.stringify({ topics: ['', 'Only email'] }) })
    ).json();
    assert.equal(draft.channel, 'Email'); // blank website topic was skipped

    const blocked = await fetch(`${base}/api/items/${draft.id}/approve`, { method: 'POST', headers: h });
    assert.equal(blocked.status, 400);

    await fetch(`${base}/api/items/${draft.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ body: 'Hello friends.' }) });
    const ok = await (await fetch(`${base}/api/items/${draft.id}/approve`, { method: 'POST', headers: h })).json();
    assert.equal(ok.status, 'Ready');

    const back = await (await fetch(`${base}/api/items/${draft.id}/unapprove`, { method: 'POST', headers: h })).json();
    assert.equal(back.status, 'Draft');
  });
});

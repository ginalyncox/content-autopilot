import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubPublisher, slugify, toMarkdownFile } from '../src/publishers/github.js';
import { ResendPublisher, looksDeliverable } from '../src/publishers/resend.js';
import type { ContentItem } from '../src/items.js';

const item: ContentItem = {
  id: '1',
  name: 'Autumn "bread" news',
  channel: 'Website',
  status: 'Ready',
  publishDate: '2026-10-27',
  body: 'Hello **there**.',
  site: 'ginamakes',
};

type Call = { url: string; method: string; body?: any };
function fakeFetch(responses: Array<{ status: number; json?: unknown }>, calls: Call[]): typeof fetch {
  return (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : undefined });
    const r = responses.shift() ?? { status: 500 };
    return new Response(r.json ? JSON.stringify(r.json) : '', { status: r.status });
  }) as typeof fetch;
}

test('slugify and markdown file', () => {
  assert.equal(slugify('Autumn "bread" news!'), 'autumn-bread-news');
  assert.match(toMarkdownFile(item), /^---\ntitle: "Autumn \\"bread\\" news"\ndate: 2026-10-27\n---/);
});

test('GitHub publisher is not connected without a token', async () => {
  const p = new GitHubPublisher({ site: 'ginamakes', repo: 'a/b', branch: 'main', pathTemplate: 'x/{slug}.md' });
  assert.equal(p.ready(), false);
  assert.equal((await p.publish(item)).ok, false);
});

test('GitHub publisher commits a new file and never overwrites', async () => {
  const calls: Call[] = [];
  const p = new GitHubPublisher(
    { site: 'ginamakes', repo: 'a/b', branch: 'main', token: 't', pathTemplate: 'posts/{date}-{slug}.md', urlTemplate: 'https://x/{slug}' },
    fakeFetch([{ status: 404 }, { status: 201, json: {} }], calls),
  );
  const res = await p.publish(item);
  assert.equal(res.ok, true);
  assert.equal(res.url, 'https://x/autumn-bread-news');
  assert.equal(calls[1].method, 'PUT');
  assert.match(calls[1].url, /posts\/2026-10-27-autumn-bread-news\.md$/);

  const clash = new GitHubPublisher(
    { site: 'ginamakes', repo: 'a/b', branch: 'main', token: 't', pathTemplate: 'p/{slug}.md' },
    fakeFetch([{ status: 200, json: {} }], []),
  );
  assert.match((await clash.publish(item)).detail, /already exists/);
});

test('mailing address check', () => {
  assert.equal(looksDeliverable('123 Main St, Altoona, IA 50009'), true);
  assert.equal(looksDeliverable('PO Box 4, Altoona, IA 50009'), true);
  assert.equal(looksDeliverable('Altoona, Iowa'), false);
  assert.equal(looksDeliverable(undefined), false);
});

test('Resend refuses to send without a full address', async () => {
  const calls: Call[] = [];
  const p = new ResendPublisher({ apiKey: 'k', segmentId: 's', from: 'a@b.c', mailingAddress: 'Iowa' }, fakeFetch([], calls));
  const res = await p.publish({ ...item, channel: 'Email' });
  assert.equal(res.ok, false);
  assert.equal(calls.length, 0);
});

test('Resend creates then sends, falling back to audience_id', async () => {
  const calls: Call[] = [];
  const p = new ResendPublisher(
    { apiKey: 'k', segmentId: 's', from: 'a@b.c', mailingAddress: '123 Main St, Altoona, IA 50009' },
    fakeFetch([{ status: 422 }, { status: 200, json: { id: 'b1' } }, { status: 200, json: {} }], calls),
  );
  const res = await p.publish({ ...item, channel: 'Email' });
  assert.equal(res.ok, true);
  assert.equal(calls[0].body.segment_id, 's');
  assert.equal(calls[1].body.audience_id, 's');
  assert.match(calls[1].body.html, /Unsubscribe/);
  assert.match(calls[2].url, /\/broadcasts\/b1\/send$/);
});

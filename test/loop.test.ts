import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBrand } from '../src/brand.js';
import { TemplateDrafter, parseDraft } from '../src/drafter.js';
import { approve, nextWeekday, planWeek, publishDue, reject } from '../src/loop.js';
import type { Publisher } from '../src/publishers/types.js';
import { MemoryStore } from '../src/store.js';

test('brand check catches the retired name, donate and extra exclamation marks', () => {
  const ids = checkBrand('Gina Makes Bread + <dev> says donate now! Today!').map((i) => i.id);
  assert.deepEqual(ids.sort(), ['donate', 'exclamations', 'retired-name']);
  assert.deepEqual(checkBrand('A Gina Makes tool. Paying gives you a license.'), []);
});

test('nextWeekday is strictly after the given day', () => {
  assert.equal(nextWeekday('2026-10-22', 5), '2026-10-23'); // Thu -> Fri
  assert.equal(nextWeekday('2026-10-23', 5), '2026-10-30'); // Fri -> next Fri
  assert.equal(nextWeekday('2026-10-22', 2), '2026-10-27'); // Thu -> Tue
});

test('parseDraft reads JSON and falls back to plain text', () => {
  assert.deepEqual(parseDraft('Here: {"title":"Hi","body":"Text"}', 'x'), { name: 'Hi', body: 'Text' });
  assert.deepEqual(parseDraft('just words', 'Topic'), { name: 'Topic', body: 'just words' });
});

test('full loop: plan, blocked template, edit, approve, publish on the day', async () => {
  const store = new MemoryStore();
  const items = await planWeek(store, new TemplateDrafter(), ['Autumn update', 'Friday letter'], { today: '2026-10-22' });
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.status === 'Draft'));

  const web = items.find((i) => i.channel === 'Website')!;
  await assert.rejects(approve(store, web.id), /template text/);

  await store.update(web.id, { body: 'Three new things in the kitchen this week.' });
  assert.equal((await approve(store, web.id)).status, 'Ready');

  const sent: string[] = [];
  const fake: Publisher = {
    id: 'fake',
    channel: 'Website',
    site: 'ginamakes',
    ready: () => true,
    publish: async (item) => (sent.push(item.id), { ok: true, detail: 'done' }),
  };

  assert.deepEqual(await publishDue(store, [fake], '2026-10-26'), []); // before Tuesday
  const results = await publishDue(store, [fake], '2026-10-27');
  assert.equal(results.length, 1);
  assert.deepEqual(sent, [web.id]);
  assert.equal((await store.get(web.id))!.status, 'Published');

  // The email draft was never approved, so it is never published.
  const email = items.find((i) => i.channel === 'Email')!;
  await publishDue(store, [fake], '2026-12-01');
  assert.equal((await store.get(email.id))!.status, 'Draft');
});

test('reject sends a draft back to Idea and it cannot jump to Published', async () => {
  const store = new MemoryStore();
  const [item] = await planWeek(store, new TemplateDrafter(), ['x'], { today: '2026-10-22' });
  const back = await reject(store, item.id);
  assert.equal(back.status, 'Idea');
  await store.update(item.id, { body: 'Clean text.' });
  await assert.rejects(approve(store, item.id), /Idea to Ready/);
});

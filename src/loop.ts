// The weekly loop: plan -> draft -> approve -> publish.

import { checkBrand, type BrandIssue } from './brand.js';
import { PLACEHOLDER, type Drafter } from './drafter.js';
import type { Channel, ContentItem } from './items.js';
import type { Publisher } from './publishers/types.js';
import { moveTo, type Store } from './store.js';

export const TIME_ZONE = 'America/Chicago';

/** Today's date (YYYY-MM-DD) in Chicago. */
export function todayIn(tz = TIME_ZONE, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** The next given weekday (0 = Sunday) strictly after `from`. */
export function nextWeekday(from: string, weekday: number): string {
  const d = new Date(`${from}T12:00:00Z`);
  const ahead = ((weekday - d.getUTCDay() + 7) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + ahead);
  return d.toISOString().slice(0, 10);
}

export interface Slot {
  channel: Channel;
  weekday: number; // 0 = Sunday
  site?: string;
}

/** Decided Oct 22: 2 posts a week to start. Website on Tuesday, email on Friday. */
export const DEFAULT_SLOTS: Slot[] = [
  { channel: 'Website', weekday: 2, site: 'ginamakes' },
  { channel: 'Email', weekday: 5 },
];

/**
 * Plans next week's slots as Ideas and drafts each one. Topics come from you (or a later planner),
 * one per slot in order. A slot with a blank topic is skipped.
 */
export async function planWeek(
  store: Store,
  drafter: Drafter,
  topics: string[],
  opts: { slots?: Slot[]; today?: string } = {},
): Promise<ContentItem[]> {
  const slots = opts.slots ?? DEFAULT_SLOTS;
  const today = opts.today ?? todayIn();
  const made: ContentItem[] = [];
  for (const [i, slot] of slots.entries()) {
    const topic = topics[i]?.trim();
    if (!topic) continue;
    const idea = await store.create({
      name: topic,
      channel: slot.channel,
      status: 'Idea',
      publishDate: nextWeekday(today, slot.weekday),
      body: '',
      site: slot.site,
    });
    const draft = await drafter.draft({ channel: slot.channel, topic, site: slot.site });
    made.push(await moveTo(store, idea.id, 'Draft', { name: draft.name, body: draft.body }));
  }
  return made;
}

/** Reasons a draft can't be approved yet. Empty means it's fine. */
export function approvalBlockers(item: ContentItem): BrandIssue[] {
  const issues = checkBrand(`${item.name}\n${item.body}`);
  if (item.body.includes(PLACEHOLDER)) issues.unshift({ id: 'placeholder', message: 'Still has template text. Edit it first.' });
  if (!item.body.trim()) issues.unshift({ id: 'empty', message: 'Has no text yet.' });
  return issues;
}

export async function approve(store: Store, id: string): Promise<ContentItem> {
  const item = await store.get(id);
  if (!item) throw new Error(`No item ${id}`);
  const blockers = approvalBlockers(item);
  if (blockers.length) throw new Error(`Can't approve "${item.name}": ${blockers.map((b) => b.message).join(' ')}`);
  return moveTo(store, id, 'Ready');
}

/** Takes back an approval before the day comes. */
export async function unapprove(store: Store, id: string): Promise<ContentItem> {
  return moveTo(store, id, 'Draft');
}

/** Sends back to Idea, so it's never published by accident. */
export async function reject(store: Store, id: string): Promise<ContentItem> {
  return moveTo(store, id, 'Idea', { rejected: true });
}

export function pickPublisher(publishers: Publisher[], item: ContentItem): Publisher | undefined {
  return publishers.find((p) => p.channel === item.channel && (item.channel !== 'Website' || p.site === item.site));
}

/** Publishes Ready items whose date has come. Only Ready items are touched. */
export async function publishDue(store: Store, publishers: Publisher[], today = todayIn()) {
  const results: { id: string; ok: boolean; detail: string }[] = [];
  for (const item of await store.list()) {
    if (item.status !== 'Ready' || item.publishDate > today) continue;
    const publisher = pickPublisher(publishers, item);
    if (!publisher) {
      results.push({ id: item.id, ok: false, detail: `No publisher for ${item.channel}${item.site ? ` on ${item.site}` : ''}` });
      continue;
    }
    const res = await publisher.publish(item);
    if (res.ok) await moveTo(store, item.id, 'Published', { result: res.url ? `${res.detail} — ${res.url}` : res.detail });
    else await store.update(item.id, { result: `Not published: ${res.detail}` });
    results.push({ id: item.id, ok: res.ok, detail: res.detail });
  }
  return results;
}

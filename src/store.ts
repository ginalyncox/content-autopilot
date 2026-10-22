// Where content items live. Version 1 target is the Notion Content & Launches
// database; until that adapter is written, items are kept in a JSON file
// (or in memory for tests). Every store has the same shape, so swapping is one line.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canMove, type ContentItem, type Status } from './items.js';

export interface Store {
  list(): Promise<ContentItem[]>;
  get(id: string): Promise<ContentItem | undefined>;
  create(item: Omit<ContentItem, 'id'>): Promise<ContentItem>;
  update(id: string, changes: Partial<Omit<ContentItem, 'id'>>): Promise<ContentItem>;
}

/** Moves an item to a new status, refusing any jump the loop doesn't allow. */
export async function moveTo(store: Store, id: string, to: Status, extra: Partial<ContentItem> = {}) {
  const item = await store.get(id);
  if (!item) throw new Error(`No item ${id}`);
  if (!canMove(item.status, to)) throw new Error(`Can't move "${item.name}" from ${item.status} to ${to}`);
  return store.update(id, { ...extra, status: to });
}

export class MemoryStore implements Store {
  protected items = new Map<string, ContentItem>();

  async list() {
    return [...this.items.values()].sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  }
  async get(id: string) {
    return this.items.get(id);
  }
  async create(item: Omit<ContentItem, 'id'>) {
    const full = { ...item, id: randomUUID() };
    this.items.set(full.id, full);
    await this.save();
    return full;
  }
  async update(id: string, changes: Partial<Omit<ContentItem, 'id'>>) {
    const item = this.items.get(id);
    if (!item) throw new Error(`No item ${id}`);
    const next = { ...item, ...changes };
    this.items.set(id, next);
    await this.save();
    return next;
  }
  protected async save(): Promise<void> {}
}

export class JsonFileStore extends MemoryStore {
  private constructor(private file: string) {
    super();
  }
  static async open(file: string) {
    const store = new JsonFileStore(file);
    try {
      const rows = JSON.parse(await fs.readFile(file, 'utf8')) as ContentItem[];
      for (const r of rows) store.items.set(r.id, r);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
    return store;
  }
  protected async save() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify([...this.items.values()], null, 2));
    await fs.rename(tmp, this.file);
  }
}

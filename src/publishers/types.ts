// A publisher sends an approved item somewhere: a website, an email list.
// Each one is a plug-in, so a buyer can later swap in their own site.

import type { Channel, ContentItem } from '../items.js';

export interface PublishResult {
  ok: boolean;
  url?: string;
  detail: string;
}

export interface Publisher {
  id: string; // e.g. "github:hearthvale", "resend"
  channel: Channel;
  site?: string; // only for website publishers
  /** False when its settings are missing. It then reports itself as not connected instead of failing. */
  ready(): boolean;
  publish(item: ContentItem): Promise<PublishResult>;
}

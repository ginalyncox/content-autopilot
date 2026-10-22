// Email publisher: creates a Resend broadcast for the item and sends it.
// Borrowed from the Studio's newsletter.js (segment_id first, audience_id fallback).
// Refuses to send without a full postal address, which CAN-SPAM requires in
// commercial email. This is a safety check, not legal advice.

import { marked } from 'marked';
import { BRAND } from '../brand.js';
import type { ContentItem } from '../items.js';
import type { Publisher, PublishResult } from './types.js';

export interface ResendConfig {
  apiKey?: string;
  segmentId?: string;
  from?: string; // e.g. "Gina Makes <hello@ginamakesbread.dev>"
  replyTo?: string;
  mailingAddress?: string;
}

const BASE = 'https://api.resend.com';

/** Street or PO Box plus a 5-digit ZIP, same check the Studio uses before sending. */
export function looksDeliverable(address?: string): boolean {
  if (!address) return false;
  return /\d{5}(-\d{4})?\b/.test(address) && (/\d+\s+\S+/.test(address) || /p\.?\s*o\.?\s*box/i.test(address));
}

export function emailHtml(item: ContentItem, mailingAddress: string): string {
  const body = marked.parse(item.body, { async: false }) as string;
  return `${body}
<hr>
<p style="font-size:13px;color:#6B5238">${BRAND.toolFooter} ${BRAND.copyright}<br>${mailingAddress}<br>
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>`;
}

export class ResendPublisher implements Publisher {
  readonly id = 'resend';
  readonly channel = 'Email' as const;

  constructor(
    private cfg: ResendConfig,
    private fetchFn: typeof fetch = fetch,
  ) {}

  ready() {
    return Boolean(this.cfg.apiKey && this.cfg.segmentId && this.cfg.from);
  }

  private async post(path: string, body: unknown) {
    const res = await this.fetchFn(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text().catch(() => '');
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* leave empty */
    }
    return { res, text, data };
  }

  async publish(item: ContentItem): Promise<PublishResult> {
    if (!this.ready()) return { ok: false, detail: 'Resend is not connected (key, segment or sender missing)' };
    if (!looksDeliverable(this.cfg.mailingAddress)) {
      return { ok: false, detail: 'Not sent: MAILING_ADDRESS is missing or has no street/PO Box and ZIP' };
    }
    const base: Record<string, unknown> = {
      name: item.name,
      from: this.cfg.from,
      subject: item.name,
      html: emailHtml(item, this.cfg.mailingAddress!),
    };
    if (this.cfg.replyTo) base.reply_to = this.cfg.replyTo;

    let broadcastId: string | undefined;
    let lastErr = '';
    for (const field of ['segment_id', 'audience_id']) {
      const { res, text, data } = await this.post('/broadcasts', { ...base, [field]: this.cfg.segmentId });
      if (res.ok && data?.id) {
        broadcastId = data.id;
        break;
      }
      lastErr = `Resend ${res.status} on ${field}: ${text.slice(0, 200)}`;
      if (!(field === 'segment_id' && (res.status === 400 || res.status === 422))) break;
    }
    if (!broadcastId) return { ok: false, detail: lastErr || 'Resend did not return a broadcast id' };

    const sent = await this.post(`/broadcasts/${broadcastId}/send`, {});
    if (!sent.res.ok) {
      return { ok: false, detail: `Broadcast ${broadcastId} created but not sent: Resend ${sent.res.status}` };
    }
    return { ok: true, detail: `Sent broadcast ${broadcastId}` };
  }
}

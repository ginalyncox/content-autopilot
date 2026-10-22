// Writes the text for an Idea. Uses Claude when ANTHROPIC_API_KEY is set;
// otherwise it leaves an editable template that can't be approved until edited.

import Anthropic from '@anthropic-ai/sdk';
import { BRAND } from './brand.js';
import type { Channel } from './items.js';

export const PLACEHOLDER = '[edit me]';

export interface DraftRequest {
  channel: Channel;
  topic: string;
  site?: string;
}

export interface Draft {
  name: string;
  body: string;
}

export interface Drafter {
  draft(req: DraftRequest): Promise<Draft>;
}

export class TemplateDrafter implements Drafter {
  async draft({ channel, topic }: DraftRequest): Promise<Draft> {
    const shape =
      channel === 'Email'
        ? 'One short hello, the news in two or three sentences, and one link.'
        : 'A short intro, three to five highlights, and a closing line.';
    return {
      name: topic,
      body: `${PLACEHOLDER} ${shape}\n\nTopic: ${topic}`,
    };
  }
}

export function parseDraft(text: string, fallbackName: string): Draft {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const data = JSON.parse(match[0]);
      if (typeof data.title === 'string' && typeof data.body === 'string') {
        return { name: data.title.trim(), body: data.body.trim() };
      }
    } catch {
      /* fall through */
    }
  }
  return { name: fallbackName, body: text.trim() };
}

export class ClaudeDrafter implements Drafter {
  private client: Anthropic;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async draft({ channel, topic, site }: DraftRequest): Promise<Draft> {
    const system =
      `You write ${channel === 'Email' ? 'short newsletter emails' : 'short website posts'} for ${BRAND.name}. ` +
      `Voice: ${BRAND.voice} ` +
      `Never write "Gina Makes Bread + <dev>". Never say "donate". ` +
      `Reply with JSON only: {"title": "...", "body": "markdown"}.`;
    const user = `Topic: ${topic}${site ? `\nSite: ${site}` : ''}\nKeep it under ${channel === 'Email' ? 150 : 300} words.`;
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const text = msg.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    return parseDraft(text, topic);
  }
}

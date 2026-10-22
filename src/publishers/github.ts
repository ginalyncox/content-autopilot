// Website publisher for sites built from a GitHub repo (heroofhearthvale.com,
// ginamakesbread.dev). It commits the post as a new file; the site's own
// deploy (GitHub Pages or Render) picks it up. Borrowed from the Studio's posts.js.

import type { ContentItem } from '../items.js';
import type { Publisher, PublishResult } from './types.js';

export interface GitHubSiteConfig {
  site: string; // short id, e.g. "hearthvale"
  repo?: string; // "owner/name"
  branch: string;
  token?: string;
  pathTemplate: string; // e.g. "hearthvale/news/{date}-{slug}.md"
  urlTemplate?: string; // e.g. "https://heroofhearthvale.com/hearthvale/news/{date}-{slug}"
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'post'
  );
}

function fill(template: string, item: ContentItem) {
  return template.replaceAll('{date}', item.publishDate).replaceAll('{slug}', slugify(item.name));
}

export function toMarkdownFile(item: ContentItem): string {
  const title = item.name.replace(/"/g, '\\"');
  return `---\ntitle: "${title}"\ndate: ${item.publishDate}\n---\n\n${item.body.trim()}\n`;
}

export class GitHubPublisher implements Publisher {
  readonly channel = 'Website' as const;
  readonly id: string;
  readonly site: string;

  constructor(
    private cfg: GitHubSiteConfig,
    private fetchFn: typeof fetch = fetch,
  ) {
    this.id = `github:${cfg.site}`;
    this.site = cfg.site;
  }

  ready() {
    return Boolean(this.cfg.repo && this.cfg.token);
  }

  private async gh(method: string, apiPath: string, body?: unknown) {
    const res = await this.fetchFn(`https://api.github.com${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    return res;
  }

  async publish(item: ContentItem): Promise<PublishResult> {
    if (!this.ready()) return { ok: false, detail: `${this.id} is not connected (repo or token missing)` };
    const filePath = fill(this.cfg.pathTemplate, item);
    const apiPath = `/repos/${this.cfg.repo}/contents/${encodeURI(filePath)}`;

    // Never overwrite: an existing file at this path means a clash, not an update.
    const existing = await this.gh('GET', `${apiPath}?ref=${encodeURIComponent(this.cfg.branch)}`);
    if (existing.ok) return { ok: false, detail: `${filePath} already exists in ${this.cfg.repo}` };
    if (existing.status !== 404) return { ok: false, detail: `GitHub ${existing.status} checking ${filePath}` };

    const res = await this.gh('PUT', apiPath, {
      message: `Publish: ${item.name}`,
      content: Buffer.from(toMarkdownFile(item), 'utf8').toString('base64'),
      branch: this.cfg.branch,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, detail: `GitHub ${res.status}: ${text.slice(0, 200)}` };
    }
    const url = this.cfg.urlTemplate ? fill(this.cfg.urlTemplate, item) : undefined;
    return { ok: true, url, detail: `Committed ${filePath} to ${this.cfg.repo}` };
  }
}

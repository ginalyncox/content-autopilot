// All settings come from environment variables. Anything missing leaves that
// part "not connected" instead of crashing, the same way the Studio works.

import { ClaudeDrafter, TemplateDrafter, type Drafter } from './drafter.js';
import { GitHubPublisher } from './publishers/github.js';
import { ResendPublisher } from './publishers/resend.js';
import type { Publisher } from './publishers/types.js';

const env = (key: string) => process.env[key]?.trim() || undefined;

export function loadConfig() {
  return {
    port: Number(env('PORT') ?? 10000),
    adminPassword: env('ADMIN_PASSWORD'),
    dataFile: env('DATA_FILE') ?? 'data/items.json',
    anthropicKey: env('ANTHROPIC_API_KEY'),
    claudeModel: env('CLAUDE_MODEL') ?? 'claude-sonnet-5-5',
  };
}

export function buildDrafter(cfg = loadConfig()): Drafter {
  return cfg.anthropicKey ? new ClaudeDrafter(cfg.anthropicKey, cfg.claudeModel) : new TemplateDrafter();
}

/** One GitHub publisher per site, plus Resend for email. Add a site by adding its settings. */
export function buildPublishers(): Publisher[] {
  const token = env('GITHUB_TOKEN');
  return [
    new GitHubPublisher({
      site: 'ginamakes',
      repo: env('GINAMAKES_REPO') ?? 'ginalyncox/gina-makes-bread-dev',
      branch: env('GINAMAKES_BRANCH') ?? 'main',
      token,
      pathTemplate: env('GINAMAKES_PATH') ?? 'content/autopilot/{date}-{slug}.md',
      urlTemplate: env('GINAMAKES_URL'),
    }),
    new GitHubPublisher({
      site: 'hearthvale',
      repo: env('HEARTHVALE_REPO') ?? 'ginalyncox/ginalyncox',
      branch: env('HEARTHVALE_BRANCH') ?? 'main',
      token,
      pathTemplate: env('HEARTHVALE_PATH') ?? 'hearthvale/news/{date}-{slug}.md',
      urlTemplate: env('HEARTHVALE_URL'),
    }),
    new ResendPublisher({
      apiKey: env('RESEND_API_KEY'),
      segmentId: env('RESEND_SEGMENT_ID'),
      from: env('EMAIL_FROM'),
      replyTo: env('EMAIL_REPLY_TO'),
      mailingAddress: env('MAILING_ADDRESS'),
    }),
  ];
}

// HTTP API for the weekly loop. The approve screen is the next feature;
// for now this is the JSON API it will call.

import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildDrafter, buildPublishers, loadConfig } from './config.js';
import type { Drafter } from './drafter.js';
import { approvalBlockers, approve, planWeek, publishDue, reject, unapprove } from './loop.js';
import { PAGE } from './ui.js';
import type { Publisher } from './publishers/types.js';
import { JsonFileStore, type Store } from './store.js';

function sameText(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function requirePassword(password: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!password) return res.status(503).json({ error: 'Set ADMIN_PASSWORD to use the app.' });
    const header = req.get('authorization') ?? '';
    const [scheme, encoded] = header.split(' ');
    const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '';
    if (sameText(given, password)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Content Autopilot"').status(401).json({ error: 'Sign in first.' });
  };
}

export function createApp(deps: { store: Store; drafter: Drafter; publishers: Publisher[]; adminPassword?: string }) {
  const { store, drafter, publishers } = deps;
  const app = express();
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  const locked = requirePassword(deps.adminPassword);
  app.get('/', locked, (_req, res) => res.type('html').send(PAGE));
  app.use('/api', locked);

  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
      fn(req, res).catch((e: Error) => res.status(400).json({ error: e.message }));

  app.get(
    '/api/items',
    wrap(async (_req, res) => {
      const items = await store.list();
      res.json(items.map((item) => ({ ...item, blockers: item.status === 'Draft' ? approvalBlockers(item) : [] })));
    }),
  );

  app.get('/api/connections', (_req, res) => {
    res.json(publishers.map((p) => ({ id: p.id, channel: p.channel, site: p.site, connected: p.ready() })));
  });

  app.post(
    '/api/plan',
    wrap(async (req, res) => {
      const topics = Array.isArray(req.body?.topics) ? req.body.topics.filter((t: unknown) => typeof t === 'string') : [];
      res.json(await planWeek(store, drafter, topics));
    }),
  );

  app.patch(
    '/api/items/:id',
    wrap(async (req, res) => {
      const item = await store.get(req.params.id);
      if (!item) throw new Error('Not found');
      if (item.status !== 'Draft') throw new Error('Only drafts can be edited.');
      const changes: { name?: string; body?: string } = {};
      if (typeof req.body?.name === 'string') changes.name = req.body.name;
      if (typeof req.body?.body === 'string') changes.body = req.body.body;
      res.json(await store.update(item.id, changes));
    }),
  );

  app.post('/api/items/:id/approve', wrap(async (req, res) => res.json(await approve(store, req.params.id))));
  app.post('/api/items/:id/reject', wrap(async (req, res) => res.json(await reject(store, req.params.id))));
  app.post('/api/items/:id/unapprove', wrap(async (req, res) => res.json(await unapprove(store, req.params.id))));
  app.post('/api/publish-due', wrap(async (_req, res) => res.json(await publishDue(store, publishers))));

  return app;
}

async function main() {
  const cfg = loadConfig();
  const store = await JsonFileStore.open(cfg.dataFile);
  const publishers = buildPublishers();
  const app = createApp({ store, drafter: buildDrafter(cfg), publishers, adminPassword: cfg.adminPassword });

  // Hourly check for Ready items whose day has come.
  const tick = () => publishDue(store, publishers).catch((e) => console.error('[publish] failed:', e.message));
  setInterval(tick, 60 * 60 * 1000).unref();

  app.listen(cfg.port, () => {
    console.log(`Content Autopilot on :${cfg.port}`);
    for (const p of publishers) console.log(`[${p.id}] ${p.ready() ? 'connected' : 'not connected'}`);
    if (!cfg.anthropicKey) console.log('[drafts] no ANTHROPIC_API_KEY, using editable templates');
    if (!cfg.adminPassword) console.log('[auth] ADMIN_PASSWORD not set, the API is locked');
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();

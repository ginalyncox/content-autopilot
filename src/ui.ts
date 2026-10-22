// The approve screen: one page, served at "/", behind the same password as the API.
// Colors, fonts and spacing follow the Gina Makes Style Guide.

export const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Content Autopilot</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;700;800&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<style>
:root {
  --surface: #EFE3C4; --raised: #F7EED7; --ink: #3D2414; --muted: #6B5238;
  --gold: #E3AA3C; --on-gold: #23180A; --line: #CDB78A; --crumb: #F3CF8E;
  --ok: #2F6B3A; --warn: #8A2E1C;
}
@media (prefers-color-scheme: dark) {
  :root { --surface: #0E1814; --raised: #16241D; --ink: #EFE3C4; --muted: #C9B98F;
          --line: #3B5245; --ok: #8FCB98; --warn: #F0A08C; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--ink);
       font: 16px/1.5 "Alegreya Sans", system-ui, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
.kicker { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 0; }
h1, h2 { font-family: "IM Fell English SC", Georgia, serif; font-weight: 400; margin: 4px 0 16px; }
h1 { font-size: 40px; line-height: 1.1; }
h2 { font-size: 26px; margin-top: 32px; }
.card { background: var(--raised); border: 1px solid var(--line); border-radius: 14px; padding: 16px; margin-bottom: 16px; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 700;
         background: var(--crumb); color: var(--on-gold); }
.badge.off { background: transparent; border: 1px solid var(--line); color: var(--muted); }
.date { color: var(--muted); font-size: 14px; }
label { display: block; font-size: 14px; font-weight: 700; margin: 12px 0 4px; }
input[type=text], textarea { width: 100%; font: inherit; color: var(--ink); background: var(--surface);
  border: 1px solid var(--line); border-radius: 4px; padding: 10px; }
textarea { min-height: 160px; resize: vertical; }
button { font: 800 16px "Alegreya Sans", system-ui, sans-serif; min-height: 44px; padding: 0 16px;
  border-radius: 4px; border: 1px solid var(--line); background: transparent; color: var(--ink); cursor: pointer; }
button.primary { background: var(--gold); color: var(--on-gold); border-color: var(--gold); }
button:disabled { opacity: .45; cursor: not-allowed; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.actions { margin-top: 12px; }
.issues { margin: 12px 0 0; padding-left: 20px; color: var(--warn); }
.body-text { white-space: pre-wrap; margin: 8px 0 0; }
.result { font-size: 14px; color: var(--muted); margin-top: 8px; overflow-wrap: anywhere; }
.empty { color: var(--muted); font-style: italic; }
#status { min-height: 24px; font-weight: 700; }
#status.bad { color: var(--warn); }
#status.good { color: var(--ok); }
footer { margin-top: 48px; color: var(--muted); font-size: 13px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
<main>
  <p class="kicker">A Gina Makes tool</p>
  <h1>This week</h1>
  <div id="connections" class="row" aria-label="Connections"></div>
  <p id="status" role="status" aria-live="polite"></p>

  <section aria-labelledby="h-plan">
    <h2 id="h-plan">Plan the week ahead</h2>
    <form id="plan" class="card">
      <label for="t-web">Website post topic (Tuesday)</label>
      <input id="t-web" type="text" placeholder="What should the website post be about?">
      <label for="t-email">Email topic (Friday)</label>
      <input id="t-email" type="text" placeholder="What should the email be about?">
      <div class="actions"><button class="primary" type="submit">Write the drafts</button></div>
    </form>
  </section>

  <section aria-labelledby="h-drafts"><h2 id="h-drafts">Needs your OK</h2><div id="drafts"></div></section>
  <section aria-labelledby="h-ready"><h2 id="h-ready">Approved, waiting for its day</h2><div id="ready"></div></section>
  <section aria-labelledby="h-done"><h2 id="h-done">Published</h2><div id="published"></div></section>
  <section aria-labelledby="h-back"><h2 id="h-back">Sent back</h2><div id="back"></div></section>

  <footer>A Gina Makes tool. © 2026 Gina Makes LLC</footer>
</main>
<script>
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) n.append(kid);
  return n;
}
function say(text, kind) { const s = $('#status'); s.textContent = text; s.className = kind || ''; }
function niceDate(d) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong (' + res.status + ').');
  return data;
}
function head(item) {
  const where = item.channel === 'Website' ? 'Website' + (item.site ? ' · ' + item.site : '') : 'Email';
  return el('div', { class: 'row' }, el('span', { class: 'badge' }, where), el('span', { class: 'date' }, niceDate(item.publishDate)));
}
function act(label, fn, primary, disabled) {
  return el('button', { type: 'button', class: primary ? 'primary' : '', disabled: !!disabled, onclick: async (e) => {
    e.currentTarget.disabled = true;
    try { await fn(); } catch (err) { say(err.message, 'bad'); }
    await load();
  } }, label);
}
function draftCard(item) {
  const nameId = 'n-' + item.id, bodyId = 'b-' + item.id;
  const name = el('input', { id: nameId, type: 'text', value: item.name });
  const body = el('textarea', { id: bodyId });
  body.value = item.body;
  const save = () => api('/api/items/' + item.id, { method: 'PATCH', body: JSON.stringify({ name: name.value, body: body.value }) });
  const blocked = item.blockers && item.blockers.length > 0;
  const issues = blocked ? el('ul', { class: 'issues' }, ...item.blockers.map((b) => el('li', {}, b.message))) : null;
  const dirty = () => name.value !== item.name || body.value !== item.body;
  return el('article', { class: 'card' },
    head(item),
    el('label', { for: nameId }, item.channel === 'Email' ? 'Subject' : 'Title'), name,
    el('label', { for: bodyId }, 'Text'), body,
    issues,
    el('div', { class: 'row actions' },
      act('Save', async () => { await save(); say('Saved.', 'good'); }),
      act('Approve', async () => {
        if (dirty()) await save();
        await api('/api/items/' + item.id + '/approve', { method: 'POST' });
        say('Approved. It goes out on ' + niceDate(item.publishDate) + '.', 'good');
      }, true, blocked),
      act('Send back', async () => { await api('/api/items/' + item.id + '/reject', { method: 'POST' }); say('Sent back. It will not be published.', 'good'); }),
    ),
    blocked ? el('p', { class: 'result' }, 'Fix the points above and press Save. Then you can approve it.') : null,
  );
}
function readCard(item, withUndo) {
  return el('article', { class: 'card' },
    head(item),
    el('h3', {}, item.name),
    el('p', { class: 'body-text' }, item.body),
    item.result ? el('p', { class: 'result' }, item.result) : null,
    withUndo ? el('div', { class: 'row actions' },
      act('Move back to drafts', async () => { await api('/api/items/' + item.id + '/unapprove', { method: 'POST' }); say('Moved back to drafts.', 'good'); })) : null,
  );
}
function fill(sel, items, make, emptyText) {
  const box = $(sel);
  box.replaceChildren(...(items.length ? items.map(make) : [el('p', { class: 'empty' }, emptyText)]));
}
async function load() {
  try {
    const [items, conns] = await Promise.all([api('/api/items'), api('/api/connections')]);
    $('#connections').replaceChildren(...conns.map((c) =>
      el('span', { class: 'badge' + (c.connected ? '' : ' off') }, (c.site || c.channel) + (c.connected ? ' · connected' : ' · not connected'))));
    fill('#drafts', items.filter((i) => i.status === 'Draft'), draftCard, 'Nothing waiting. Plan the week ahead above.');
    fill('#ready', items.filter((i) => i.status === 'Ready'), (i) => readCard(i, true), 'Nothing approved yet.');
    fill('#published', items.filter((i) => i.status === 'Published').reverse(), (i) => readCard(i, false), 'Nothing published yet.');
    fill('#back', items.filter((i) => i.status === 'Idea'), (i) => readCard(i, false), 'Nothing sent back.');
  } catch (err) { say(err.message, 'bad'); }
}
$('#plan').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  say('Writing drafts…');
  try {
    const topics = [$('#t-web').value.trim(), $('#t-email').value.trim()];
    if (!topics.some(Boolean)) throw new Error('Add at least one topic.');
    await api('/api/plan', { method: 'POST', body: JSON.stringify({ topics }) });
    e.target.reset();
    say('Drafts are ready for your OK below.', 'good');
  } catch (err) { say(err.message, 'bad'); }
  btn.disabled = false;
  await load();
});
load();
</script>
</body>
</html>`;

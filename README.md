# Content Autopilot (working name)

Drafts a week of posts from your brand rules, waits for your approval, then publishes.
A Gina Makes tool. © 2026 Gina Makes LLC.

## The loop

1. **Plan:** `POST /api/plan` with this week's topics. Makes 2 items: a website post (Tuesday) and an email (Friday).
2. **Draft:** Claude writes each one (or an editable template if no `ANTHROPIC_API_KEY`).
3. **Approve:** `POST /api/items/:id/approve`. Refused while a draft has template text or breaks a brand rule.
4. **Publish:** every hour, Ready items whose date has come go out. Nothing else is ever published.

Statuses match the Notion Content & Launches database: Idea → Draft → Ready → Published.

## Publishers (swappable)

| Publisher | Sends to | Needs |
| --- | --- | --- |
| `github:ginamakes` | ginamakesbread.dev (commits a file, Render rebuilds) | `GITHUB_TOKEN` |
| `github:hearthvale` | heroofhearthvale.com (commits a file, GitHub Pages rebuilds) | `GITHUB_TOKEN` |
| `resend` | Your email list | `RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `EMAIL_FROM`, `MAILING_ADDRESS` |

Anything not set up shows as "not connected" at `GET /api/connections` instead of failing.

## Run it

```bash
npm install
cp .env.example .env   # fill in ADMIN_PASSWORD at least
npm run dev            # http://localhost:10000
npm test
```

## Not built yet

- The approve screen (next)
- Notion store (items live in `data/items.json` for now)
- Turning the markdown file into a page each site can show (both sites need a small change)
- Devlog engine: weekly roundup from `hearthvale/CHANGELOG.md`

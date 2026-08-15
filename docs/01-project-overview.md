# 01 — Project Overview

## What TBS Digital is

TBS Digital is a digital agency. The website is a **single-page marketing / landing site**
that presents the agency's services, past work, team, and a project-price estimator, and
lets a visitor send a project request.

## What we are building (this repo)

The **frontend UI** of that landing page, rebuilt in Next.js from an existing design
prototype (`TBS Digital.dc.html`). The visual language is a dark, "cyber-brutalist" theme:
deep navy background, blue/cyan accents, monospace + heavy display typography, subtle
glow and scroll-reveal animations.

## Current state — full-stack and wired

The project is now a working full-stack app:

- The landing page and its sections are presentational Next.js components.
- Content is served by the **FastAPI + database** backend: the frontend loads
  `GET /api/content` (localStorage is only an offline cache), the admin Saves via
  `PUT /api/content`, and the contact form `POST`s to `/api/contact`.
- The **admin** ([09 — Admin Panel](./09-admin.md)) is login-gated (real bcrypt auth, not a PIN)
  and organized into tabs, with a **Cereri** tab that lists incoming contact requests.
- All input is **validated on both layers** (anti-XSS/SQLi, lengths, email/URL — see
  [11 — Security](./11-security.md)).
- The whole stack starts with one command via Docker Compose + Make
  ([12 — Deployment](./12-deployment.md)).
- The site is **trilingual (RO / RU / EN)** — a switcher plus crawlable `/`, `/ru`, `/en`
  URLs, hreflang, sitemap, JSON-LD and locale-aware Open Graph. Editable content carries all
  three languages. See [16 — i18n & SEO](./16-i18n-seo.md).
- **Legal + consent:** `/confidentialitate` and `/cookies` pages, and a GDPR / Law-133
  cookie banner that gates the analytics pixel — nothing tracking loads before consent.

Data-driven content (stats, services, team, partners, projects, prices, contacts) is managed
through the admin and stored in the database. **Real business content is in** for the team,
projects and partners; stats and prices are still the agency's to fill in through the admin.

## Who did what

- **This repo:** the frontend UI, the FastAPI backend (real DB + auth), the frontend↔API
  integration, input validation/security, the Docker/Make deployment, the trilingual +
  SEO layer, and the Telegram lead bot.

## Remaining (Phase 4 — optional polish)

- Alembic migrations, admin-password rotation, server-side token revocation.
- Email notification on new submissions (the Telegram bot already ships).
- Honeypot/CAPTCHA on the contact form; edge (nginx) rate limits.
- Remaining business content (stats, prices) entered through the admin.
- Production secrets + HTTPS/reverse proxy (the `.env` checklist).

See [08 — Roadmap](./08-roadmap.md) for how these phases connect, and
[`CHANGELOG.md`](../CHANGELOG.md) for what changed when.

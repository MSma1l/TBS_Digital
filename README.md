# TBS Digital

Marketing / landing website for **TBS Digital** — a digital agency (custom software,
mobile apps, AI automation, CRM, SaaS). Full-stack: **Next.js frontend + FastAPI backend +
Postgres**, wired together, with a login-gated admin and a one-command Docker deployment.

- **Frontend:** Next.js (React) in the repo root. A login-gated, tabbed
  [admin panel](./docs/09-admin.md) at `/admin-tbs-digital` edits site content and shows
  incoming requests. Reads content from the API (localStorage is just an offline cache).
- **Backend:** Python + FastAPI in [`backend/`](./backend/README.md) — content + contact +
  auth API, backed by a **real SQL database** (SQLModel; SQLite dev / Postgres prod) with
  **bcrypt** auth. See [10 — Backend](./docs/10-backend.md).
- **Security:** all input validated on both layers (anti-XSS/SQLi, lengths, email/URL). See
  [11 — Security](./docs/11-security.md).
- **Deploy:** `cp .env.example .env && make up` starts everything. See
  [12 — Deployment](./docs/12-deployment.md).
- **Telegram lead bot:** `@TBS_Notification_Agent_bot` posts every new contact-form lead into a
  private group — one topic per service, inline classification buttons, `/stats`. See
  [13 — Telegram Bot](./docs/13-telegram.md).
- **Site language:** Romanian (UI copy). Documentation is in English.

## Documentation

All project documentation lives in [`docs/`](./docs). Start here:

| Doc | What it covers |
|-----|----------------|
| [01 — Project Overview](./docs/01-project-overview.md) | What we're building, goals, current phase |
| [02 — Tech Stack](./docs/02-tech-stack.md) | Chosen technologies and why |
| [03 — Architecture](./docs/03-architecture.md) | Folder structure, routing, component layout |
| [04 — Design System](./docs/04-design-system.md) | Colors, fonts, spacing, effects |
| [05 — Page Sections](./docs/05-page-sections.md) | Breakdown of every section on the landing page |
| [06 — Placeholder Rules](./docs/06-placeholder-rules.md) | Exactly what content to remove / stub out |
| [07 — Conventions](./docs/07-conventions.md) | Coding rules and constraints (UI-only, no API) |
| [08 — Roadmap](./docs/08-roadmap.md) | Phases from UI to backend integration |
| [09 — Admin Panel](./docs/09-admin.md) | The `/admin-tbs-digital` tabbed editor + Cereri tab (real login) |
| [10 — Backend](./docs/10-backend.md) | The FastAPI content + contact + auth API (real DB) |
| [11 — Security](./docs/11-security.md) | Input validation & security (XSS, SQLi, lengths, auth) |
| [12 — Deployment](./docs/12-deployment.md) | Docker Compose + Makefile + production `.env` |
| [13 — Telegram Bot](./docs/13-telegram.md) | Lead-notification bot: per-service topics, classification buttons, /stats |
| [14 — Testing](./docs/14-testing.md) | Vitest UI/UX tests, backend pytest, live API verification script |

## Getting started

### Everything at once (Docker) — recommended

```bash
cp .env.example .env     # edit the secrets (checklist inside the file)
make up                  # db + backend + frontend
# Frontend http://localhost:3000 · API docs http://localhost:8000/docs
```

`make` lists all targets (`down`, `logs`, `test`, `clean`, …). See
[12 — Deployment](./docs/12-deployment.md).

### Locally without Docker

```bash
# Frontend
npm install && npm run dev          # http://localhost:3000

# Backend (SQLite by default — no Postgres needed)
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: ./.venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000           # http://localhost:8000/docs
```

Point the frontend at the API with `NEXT_PUBLIC_API_URL` (see `.env.local.example`).

## Design reference

The original design prototype lives in [`docs/reference/`](./docs/reference):
`TBS Digital.dc.html` (+ `support.js`). It is an exported design-tool file and is
**reference only** — we rebuild it in Next.js. The `.jpeg` files there are the two visual
moodboards.

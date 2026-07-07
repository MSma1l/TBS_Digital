# TBS Digital

Marketing / landing website for **TBS Digital** — a digital agency (custom software,
mobile apps, AI automation, CRM, SaaS). This repository holds the **frontend UI** and a
scaffolded **backend API**.

- **Frontend:** Next.js (React) in the repo root. Includes a PIN-gated
  [admin panel](./docs/09-admin.md) at `/admin-tbs-digital` for editing site content.
- **Backend:** Python + FastAPI in [`backend/`](./backend/README.md) — content + contact API.
  **No database yet** (persistence is a JSON stand-in); the DB + real integration are the
  colleague's task. The UI does not call it yet. See [10 — Backend](./docs/10-backend.md).
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
| [09 — Admin Panel](./docs/09-admin.md) | The `/admin-tbs-digital` content editor (PIN, localStorage) |
| [10 — Backend](./docs/10-backend.md) | The FastAPI content + contact API (JSON stand-in, no DB yet) |

## Getting started

Frontend:

```bash
npm install
npm run dev      # http://localhost:3000
```

Backend (optional — not wired to the UI yet, see [`backend/README.md`](./backend/README.md)):

```bash
cd backend
python -m venv .venv && ./.venv/Scripts/activate   # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000          # http://localhost:8000/docs
```

## Design reference

The original design prototype lives in [`docs/reference/`](./docs/reference):
`TBS Digital.dc.html` (+ `support.js`). It is an exported design-tool file and is
**reference only** — we rebuild it in Next.js. The `.jpeg` files there are the two visual
moodboards.

# TBS Digital

Marketing / landing website for **TBS Digital** — a digital agency (custom software,
mobile apps, AI automation, CRM, SaaS). This repository contains the **frontend UI**.

- **Frontend:** Next.js (React) — this repo. Includes a PIN-gated
  [admin panel](./docs/09-admin.md) at `/admin-tbs-digital` for editing site content.
- **Backend:** Python + FastAPI — built separately by a colleague. Not called yet
  (admin edits persist to the browser's localStorage as a stand-in).
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

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Design reference

The original design prototype lives in [`docs/reference/`](./docs/reference):
`TBS Digital.dc.html` (+ `support.js`). It is an exported design-tool file and is
**reference only** — we rebuild it in Next.js. The `.jpeg` files there are the two visual
moodboards.

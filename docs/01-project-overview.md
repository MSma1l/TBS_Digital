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

## Scope of the current phase

**UI + a self-contained admin, still no backend.** Concretely, in this phase we:

- Rebuild the landing page and its sections as presentational Next.js components.
- Make **no** network calls, **no** data fetching, and read **nothing** from the backend.
- Start data-driven content as **placeholders** (see [06 — Placeholder Rules](./06-placeholder-rules.md)),
  editable through a **built-in admin panel** ([09 — Admin Panel](./09-admin.md)) that persists
  to the browser's `localStorage`.

Anything that will eventually come from a database (stats, services, team members, partners,
prices, contacts) is managed today by that admin panel via a client-side content store, so a
colleague can later swap `localStorage` for the FastAPI backend without changing the UI.

## Who does what

- **This repo (me):** the frontend UI and the FastAPI backend **scaffold** (API + JSON
  stand-in) in [`backend/`](../backend/README.md).
- **Colleague:** the backend **database** + real auth, and wiring the frontend to the API
  (see the Handoff in `backend/README.md`).

## Out of scope for now

- The backend **database** and real auth (the API uses a JSON stand-in + a PIN/JWT stand-in)
- **Frontend ↔ API integration** — the UI still reads/writes `localStorage`, not the server
- Content in final form — everything data-driven starts as a placeholder

See [08 — Roadmap](./08-roadmap.md) for how these phases connect.

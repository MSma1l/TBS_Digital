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

**UI only.** Concretely, in this phase we:

- Rebuild the landing page and its sections as static, presentational Next.js components.
- Make **no** network calls, **no** data fetching, and read **nothing** from the backend.
- Replace all business-specific hardcoded data (stats, project names, team members,
  prices) with **placeholders**. See [06 — Placeholder Rules](./06-placeholder-rules.md).

Anything that will eventually come from a database (stats, portfolio projects, team
members, service prices) is treated as content that a future **admin page** will manage,
which a colleague will later wire to the FastAPI backend.

## Who does what

- **This repo (me):** the frontend UI.
- **Colleague:** the Python + FastAPI backend and its integration with the admin page.

## Out of scope for now

- Backend / API integration
- The admin page's real logic (it exists in the prototype as a price editor; here it is a
  future destination, not built yet)
- Authentication, database, form submission handling
- Content in final form — everything data-driven is a placeholder

See [08 — Roadmap](./08-roadmap.md) for how these phases connect.

# 08 — Roadmap

High-level phases. Only Phase 1 is active now.

## Phase 1 — UI (current)

Rebuild the landing page in Next.js as static, presentational components.

- All sections built to match the design.
- Business data replaced with placeholders ([06 — Placeholder Rules](./06-placeholder-rules.md)).
- No API calls, no data fetching, no form submission.
- Reserve the `/admin` route (not built).

**Done when:** the landing page looks like the approved design, is responsive, and contains
no hardcoded stats/projects/team/prices — only placeholders.

## Phase 2 — Admin page (later)

Build `/admin` as its own page where the agency manages the data that is currently
placeholder: stats, portfolio projects, team members, and service prices.

- UI for creating/editing that content.
- Still owned by the frontend, but designed to talk to the backend in Phase 3.

## Phase 3 — Backend integration (colleague)

Wire the frontend to the **Python + FastAPI** backend.

- Admin page reads/writes real data through the API.
- The landing page's placeholder sections are fed by the same data (stats, projects, team,
  prices become live).
- Contact form submits real requests.

Because Phase 1 keeps all content in `lib/content.ts` with realistic shapes, Phase 3 mostly
means swapping the data source per section — not rewriting the UI.

## Ownership

| Phase | Owner |
|-------|-------|
| 1 — UI | This repo (me) |
| 2 — Admin page | Frontend (TBD) |
| 3 — Backend + integration | Colleague |

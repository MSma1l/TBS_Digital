# 08 — Roadmap

High-level phases. Phases 1–2 are built; Phase 3 (backend) is the colleague's.

## Phase 1 — UI (done)

Rebuild the landing page in Next.js as static, presentational components.

- All sections built to match the design.
- Business data replaced with placeholders ([06 — Placeholder Rules](./06-placeholder-rules.md)).
- No API calls, no data fetching, no real form submission.

**Done when:** the landing page looks like the approved design, is responsive, and contains
no hardcoded stats/projects/team/prices — only placeholders.

## Phase 2 — Admin page (done, localStorage stand-in)

`/admin-tbs-digital` — a PIN-gated panel where the agency manages the content that is
otherwise placeholder: **services (+ prices), stats, team members, partners, contacts**.

- Every list can be **added to or removed from**, not just edited in place.
- Edits persist to **localStorage** via `lib/siteContent.tsx` and show live on the homepage.
- Still **no backend**: the PIN gate (`tbs2026`) is a client-side guard, and localStorage is
  the stand-in for the future API. Overrides are per-browser.
- Built so Phase 3 only has to replace the load/save + auth inside `siteContent` — the admin
  UI and the sections stay the same.

## Phase 3 — Backend integration (colleague)

Wire the frontend to the **Python + FastAPI** backend.

- Admin page reads/writes real data through the API.
- The landing page's placeholder sections are fed by the same data (stats, projects, team,
  prices become live).
- Contact form submits real requests.

Because Phase 1 keeps all content in `lib/content.ts` with realistic shapes, Phase 3 mostly
means swapping the data source per section — not rewriting the UI.

## Ownership

| Phase | Owner | Status |
|-------|-------|--------|
| 1 — UI | This repo | Done |
| 2 — Admin page (localStorage) | This repo | Done |
| 3 — Backend + integration | Colleague | Pending |

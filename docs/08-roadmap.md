# 08 — Roadmap

High-level phases. Phases 1–2 are built and the backend API is scaffolded (Phase 3a);
the database + real integration (Phase 3b) is the colleague's.

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

## Phase 3a — Backend API scaffold (done, JSON stand-in)

The **Python + FastAPI** service in [`backend/`](../backend/README.md) — content + contact
endpoints matching the frontend contract. See [10 — Backend](./10-backend.md).

- `GET/PUT /api/content` (mirrors `SiteData`), `POST /api/contact` + admin submissions list,
  `POST /api/auth/login` (env-credentials → JWT stand-in).
- Persistence sits behind a `ContentStore` interface with a temporary **JSON-file** store.
- **No database yet** — that's Phase 3b.

## Phase 3b — Database + integration (colleague)

- Implement `ContentStore` against a real DB (see the Handoff in `backend/README.md`) and
  swap it in; replace the auth stand-in with DB-backed users.
- Wire the frontend to the API: `siteContent.tsx` reads `GET /api/content` and the admin
  Saves via `PUT`; the PIN gate becomes the login; the contact form `POST`s.
- The landing page's content becomes live for everyone (not just per-browser localStorage).

Because the content shapes are stable (`lib/content.ts` / `backend/app/schemas.py`), this is
mostly swapping the data source — not rewriting the UI.

## Ownership

| Phase | Owner | Status |
|-------|-------|--------|
| 1 — UI | This repo | Done |
| 2 — Admin page (localStorage) | This repo | Done |
| 3a — Backend API scaffold (JSON stand-in) | This repo | Done |
| 3b — Database + integration | Colleague | Pending |

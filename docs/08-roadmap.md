# 08 — Roadmap

High-level phases. **Phases 1 through 3b are built and verified** — the app now runs
full-stack (Next.js + FastAPI + Postgres) with a real database, real auth, input
validation/security, and a one-command Docker deployment. Phase 4 lists what's left for
production polish.

## Phase 1 — UI (done)

Rebuild the landing page in Next.js as static, presentational components.

- All sections built to match the design.
- Business data replaced with placeholders ([06 — Placeholder Rules](./06-placeholder-rules.md)).
- No API calls, no data fetching, no real form submission.

**Done when:** the landing page looks like the approved design, is responsive, and contains
no hardcoded stats/projects/team/prices — only placeholders.

> **Note:** Phases 2 and 3a below describe the original localStorage/JSON stand-ins. They were
> **superseded** by Phases 3b–3d (real DB, real auth, API-wired frontend). Kept here as history.

## Phase 2 — Admin page (superseded by 3b)

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

## Phase 3b — Database + integration (done)

- **Real database:** `DbStore` implements `ContentStore` with SQLModel/SQLAlchemy 2 (SQLite by
  default, Postgres via `DATABASE_URL`). Tables are created and seeded from `defaults.py` on
  startup. `JSONFileStore` stays in the tree as reference only.
- **Real auth:** DB `users` table with **bcrypt-hashed** passwords; the first admin is seeded
  from `ADMIN_USERNAME`/`ADMIN_PASSWORD`. The PIN gate is replaced by a real login.
- **Frontend wired to the API:** `siteContent.tsx` loads `GET /api/content` (localStorage kept
  only as an offline cache/fallback), the admin Saves via `PUT /api/content` with a bearer
  token, and the contact form `POST`s to `/api/contact`. Content is now live for every visitor.

## Phase 3c — Security & admin UX (done)

- **Input validation on both layers** — `lib/validation.ts` (frontend) mirrors
  `backend/app/validators.py`/`schemas.py` (backend, authoritative): length caps, email/phone
  format, HTML/script escaping (anti-XSS), http/https-only URLs, ORM-parameterized queries
  (anti-SQLi), 1 MB body guard, list caps. See [11 — Security](./11-security.md).
- **Tabbed admin** — each content group is its own tab; a **Cereri** (submissions) tab is
  first, showing contact-form requests newest-first with a count badge. See
  [09 — Admin Panel](./09-admin.md).

## Phase 3d — Deployment (done)

One-command **Docker Compose** (frontend + backend + Postgres) + a `Makefile`, plus a
production-ready root `.env.example`. See [12 — Deployment](./12-deployment.md).

## Phase 3e — Telegram lead bot (done)

New-submission notifications over Telegram. `@TBS_Notification_Agent_bot` posts every new
contact-form lead into a private group, sorted into **forum topics** by service (one per
service + a General/"Altele" fallback, auto-created). Each lead message has inline
**classification buttons** (🆕 Nou / 📞 Contactat / 💰 Ofertă / ✅ Câștigat / ❌ Pierdut) that
update the submission's `status`; a `/stats` command reports totals per service and per status.

- Runs as a **long-polling background worker** in the FastAPI app lifespan — no public webhook,
  works in local dev and Docker.
- Best-effort: a Telegram outage never breaks `POST /api/contact`.
- Config via `.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`, `TELEGRAM_ENABLED`).
- See [13 — Telegram Bot](./13-telegram.md).

## Phase 3f — Security hardening & pentest (done)

Defensive pentest (4-dimension audit) + hardening + security regression tests. All CRITIC/ÎNALT
findings fixed. Highlights: production fail-fast config guard, CORS lockdown, **rate limiting**
(login/contact), security headers, streaming body-size cap, submissions pagination, Telegram
action authorization (`/register` hijack closed), bcrypt 72-byte + JWT aud/iss. See
[`SECURITY.md`](../SECURITY.md), the per-topic skills ([15 — Security Skills](./15-security-skills.md)),
and `backend/tests/test_security_*.py`.

## Phase 3g — Mobile UI pass (done)

Responsive polish for phones (single `≤640px` breakpoint): overflow-safe grids,
`/03 Servicii` and `/04 Proiecte` turned into auto-rolling scroll-snap carousels
(shared `useAutoCarousel` hook — starts on first view, pauses on manual slide,
resumes after 5s), `/02` orphan-cell fix + skeleton placeholders for blank stats,
and a tidy 2-column footer partners grid. See
[04 — Design System → Mobile](./04-design-system.md#mobile--640px).

## Phase 4 — Production polish (remaining)

Not blockers for running the app, but recommended before going fully live:

- **Alembic migrations** (currently `create_all`), and admin-password rotation.
- **Server-side token revocation** (logout ends the session) + submission retention/pruning.
- **Notifications** on new submissions (email; Telegram lead bot already ships).
- Honeypot/CAPTCHA on the contact form; edge (nginx) rate limits.
- HTTPS/reverse proxy + real secrets (the `.env` production checklist / prod guard).
- Fill in the real business content (stats, projects, team, prices) through the admin.

## Ownership

| Phase | Owner | Status |
|-------|-------|--------|
| 1 — UI | This repo | Done |
| 2 — Admin page (localStorage) | This repo | Done |
| 3a — Backend API scaffold (JSON stand-in) | This repo | Done |
| 3b — Database + integration | This repo | Done |
| 3c — Security & admin UX | This repo | Done |
| 3d — Deployment (Docker/Make) | This repo | Done |
| 3e — Telegram lead bot | This repo | Done |
| 3f — Security hardening & pentest | This repo | Done |
| 3g — Mobile UI pass | This repo | Done |
| 4 — Production polish | This repo | Remaining |

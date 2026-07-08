# 10 — Backend

The **Python + FastAPI** service that serves the site's editable content and receives
contact-form submissions. It lives in [`backend/`](../backend/README.md), which has the full
setup, API reference, and colleague handoff. This page is the high-level summary.

## Status

**Implemented and tested (20 tests).** Persistence is a **real SQL database** (SQLModel /
SQLAlchemy 2 — SQLite by default, Postgres via `DATABASE_URL`), tables auto-created and seeded
on startup. Auth is **real**: DB users with **bcrypt-hashed** passwords. Input is validated and
sanitized (see [11 — Security](./11-security.md)). The whole stack runs via Docker Compose
(see [12 — Deployment](./12-deployment.md)). The old JSON-file store remains in the tree as
reference only. Remaining production polish (Alembic, rate limiting, notifications) is Phase 4.

## What it does

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/api/content` | public | Return the whole content document |
| `PUT` | `/api/content` | admin | Replace it (the admin's Save) |
| `POST` | `/api/contact` | public | Store a contact-form submission |
| `GET` | `/api/admin/submissions` | admin | List submissions |
| `POST` | `/api/auth/login` | public | Credentials → JWT |
| `GET` | `/api/auth/me` | admin | Validate the token |

The `SiteContent` schema mirrors the frontend's `SiteData` (`lib/siteContent.tsx`), so the
content endpoints are a drop-in for the current localStorage store.

## Design — one seam for the database

Everything above storage (routers, schemas, auth) depends on a single `ContentStore`
interface (`backend/app/storage/base.py`). It is now backed by **`DbStore`** (SQLModel);
`JSONFileStore` stays as a reference implementation, swapped at one line in
`backend/app/deps.py`.

```
routers → ContentStore (interface) → DbStore        (active — SQLModel, SQLite/Postgres)
                                    → JSONFileStore  (reference only)
```

Key files: `app/models.py` (tables: services, stats, team, partners, contacts, submissions,
users — each content list keeps a `position` column for order), `app/db.py` (engine +
`create_db_and_tables` + `get_session`), `app/storage/db_store.py` (upsert-by-id + delete-missing
on `PUT`), `app/seed.py` (idempotent startup seed of content + the hashed admin).

## Auth (real)

Admin users live in a DB `users` table with **bcrypt-hashed** passwords. The first admin is
seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup. `POST /api/auth/login` verifies the
hash in constant time (dummy-verify for unknown users) and returns a short-lived JWT that guards
`PUT /api/content` and `GET /api/admin/submissions`. See [11 — Security](./11-security.md).

## What remains (Phase 4, optional polish)

The DB, auth, validation, integration and deployment are **done**. Remaining production nice-to-
haves (see [08 — Roadmap](./08-roadmap.md) Phase 4): Alembic migrations (currently `create_all`),
admin-password rotation, rate limiting, and new-submission notifications (email/Telegram). The
authoritative detail lives in [`backend/README.md`](../backend/README.md).

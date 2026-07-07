# 10 — Backend

The **Python + FastAPI** service that serves the site's editable content and receives
contact-form submissions. It lives in [`backend/`](../backend/README.md), which has the full
setup, API reference, and colleague handoff. This page is the high-level summary.

## Status

Scaffolded and tested, but **pre-database**. Persistence is a temporary **JSON-file**
stand-in. The database, its migrations, and real auth are the colleague's task (Phase 3b in
[08 — Roadmap](./08-roadmap.md)).

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
interface (`backend/app/storage/base.py`). Today it's backed by `JSONFileStore`; the colleague
implements a `DbStore` with the same four methods and swaps it in one line
(`backend/app/deps.py`). This mirrors the frontend, which uses `localStorage` behind the same
kind of swap point.

```
routers → ContentStore (interface) → JSONFileStore   (now, temporary)
                                    → DbStore         (colleague, later)
```

## Auth (stand-in)

Admin credentials live in `.env`; login returns a JWT that guards the write routes. It is a
**client-of-convenience stand-in**, not production auth (no user accounts, no hashing). The
colleague replaces the credential check with DB-backed, hashed-password users behind the same
`backend/app/security.py` functions.

## What the colleague does

Summarised here; the authoritative checklist is the **Handoff** section of
[`backend/README.md`](../backend/README.md): implement `ContentStore` against a DB
(SQLModel/Alembic; SQLite → Postgres), seed from `defaults.py`, swap in real auth, deploy —
then wire the frontend (`siteContent.tsx` → API, PIN → login, contact form → `POST`).

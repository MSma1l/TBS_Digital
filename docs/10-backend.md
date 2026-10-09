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
| `POST` | `/api/admin/uploads` | admin | Store a picture (logo, photo, screenshot) → WebP, longest side ≤ 1600px |
| `POST` | `/api/admin/uploads/capture` | admin | Store a project's whole-site capture → WebP, 1080px wide, ≤ 12000px tall ([below](#project-captures-fullpage-2026-10-06)) |
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

Schema changes are applied at boot by `create_db_and_tables` in `app/db.py`, not by
Alembic (there is none). It does three things beyond `create_all`, all idempotent: drops
the pre-logo `partners` table so it can be recreated with its new primary key; `ALTER
TABLE … ADD COLUMN` for columns added to a model after its table already existed; and
**backfills** those new columns on the existing rows. That last step is the one that is
easy to forget — a fresh column starts empty on every row, so a *content* column added
without a backfill leaves the site silently rendering nothing there (it happened once
with `partners.preview`). `tests/test_migration.py` pins all of it against a database in
the old shape. The latest such columns are `projects.full_page`
([below](#project-captures-fullpage-2026-10-06)) and `projects.demo`
([below](#project-demos-demo-2026-10-06)).

Key files: `app/models.py` (tables: services, stats, team, projects, project_images,
partners, contacts, submissions,
users — each content list keeps a `position` column for order), `app/db.py` (engine +
`create_db_and_tables` + `get_session`), `app/storage/db_store.py` (upsert-by-id + delete-missing
on `PUT`), `app/seed.py` (idempotent startup seed of content + the hashed admin),
`app/routers/uploads.py` (the two image uploads).

## Project captures (`fullPage`, 2026-10-06)

A project can carry one **whole-site capture**: a single tall WebP of its site, top to bottom,
that /portofoliu's screen scrolls through. A project without one leaves it empty, and the
screen shows `images[0]` instead.

- **Field and column.** `fullPage` in the JSON and in `Project` (`app/schemas.py`) — a
  `LinkStr` like every other image reference, so a site-relative path or an `http(s)` URL,
  rejected (never escaped) when unsafe — and `full_page` on the `projects` table
  (`ProjectRow`), read and written by `DbStore` with the other project fields.
- **Migration: a one-time backfill.** `create_db_and_tables` ALTERs `full_page` into an
  existing `projects` table (`VARCHAR NOT NULL DEFAULT ''`), and on **the boot that adds it**
  `_backfill_project_full_pages` gives the four shipped projects with a bundled capture their
  path: `bizcheck` → `/projects/bizcheck-site.webp`, `itara-global` →
  `/projects/itara-site.webp`, `cgam` → `/projects/cgam-site.webp`, `balloons-breeze` →
  `/projects/balloons-breeze-site.webp` — the same list as `lib/content.ts` and
  `defaults.default_projects()`. Only rows that are still empty are filled; every other project
  stays empty. It never runs again, so a capture the admin clears later stays cleared. A fresh
  database gets the four from the seed instead.
- **Upload: `POST /api/admin/uploads/capture`** — multipart `file`, admin-only, 20/min →
  `201 {"url": "/api/uploads/<uuid>.webp"}`, ready to save as the project's `fullPage`. The
  same guards as the picture upload: an 8 MB streamed cap (413, with a hint to save the page
  as JPG or WebP — the admin also refuses a bigger file before sending it, since past ~10 MB
  `BodySizeLimitMiddleware` stops the request with its own generic message), PNG/JPEG/WebP
  decided by the magic bytes (400) and decoded **only by that format's decoder**, a 24 MP
  pixel cap read from the header before decoding (400 — it is what limits a long page: about
  16,600px at 1440 wide, 22,200px at 1080), the 512 MB uploads budget (507) and decoding in a
  worker thread. Then its own geometry: turned upright when its EXIF says it was held
  sideways, scaled to **1080px wide** when wider (ratio kept, never upscaled) and **cut at
  12000px** from the top — the bottom of a longer page is dropped, not squashed — rebuilt from
  raw pixels (no EXIF/ICC/XMP survives; 16-bit grey is scaled to 8 bits, not clipped) and
  stored as WebP quality 80. Any decoding failure, a malformed chunk included, is a 400.
  Captures decode **one at a time**, in their own lane beside the two picture decodes: at the
  pixel cap one peaks at ~150-290 MB of RAM for a PNG or JPEG and ~370 MB for a WebP.
- **A save keeps a capture it does not name.** `PUT /api/content` replaces the document, but a
  project sent **without** a `fullPage` key (an admin page loaded before the field existed,
  saving after the deploy) keeps the capture stored for it (`_sync_projects` writes the column
  only when the key is in `model_fields_set`); `"fullPage": ""` still clears it. DbStore only:
  the JSON stand-in writes the whole document as sent.
- **Pinned by** `tests/test_uploads.py` (1440×9000 → 1080×6750, 1080×14000 → 1080×12000 with
  its top kept, 800×3000 untouched, admin-only), `tests/test_migration.py` (the boot adds the
  column, fills the four, leaves any other project empty, and never refills a cleared one) and
  `tests/test_api.py` (a save without the key keeps the capture; an explicit `""` clears it).

## Project demos (`demo`, 2026-10-06)

A project can name one **interactive demo**: a static manifest the site serves
(`public/projects/demo/<id>/demo.json`, made by `tools/site-demo/`, parsed by `lib/siteDemo.ts`)
of a few of its site's pages with their links and buttons, which /portofoliu's screen lets a
visitor press through ([05](./05-page-sections.md#portfolio--portofoliu)). Empty means no demo.

- **Field and column.** `demo` in the JSON and in `Project` (`app/schemas.py`) — a
  `SitePathStr` (`app/validators.py`): a `LinkStr` that must be a path on the site (`/…`) or empty,
  since the screen reads a manifest from nowhere else — and `demo` on the `projects` table
  (`ProjectRow`), read and written by
  `DbStore` with the other project fields. The backend keeps only the path: it never fetches,
  reads or checks the manifest, and there is no upload route for one (manifests ship with the
  site). The front end checks the manifest before it draws anything from it
  ([11](./11-security.md#the-interactive-demo-on-portofoliu-2026-10-06)).
- **Migration: a one-time backfill**, the `full_page` recipe. `create_db_and_tables` ALTERs
  `demo` into an existing `projects` table (`VARCHAR NOT NULL DEFAULT ''`, in the same
  `_add_missing_columns` call as `full_page`), and on **the boot that adds it**
  `_backfill_project_demos` gives every shipped project its manifest,
  `/projects/demo/<id>/demo.json` for all nine (`bizcheck`, `itara-global`, `docusafe`,
  `crowe-portal`, `cgam`, `iq-arena`, `balloons-breeze`, `statistic`, `flirt`) — the same list
  as `lib/content.ts` and `defaults.default_projects()`. Only rows that are still empty are
  filled; an admin's own project stays empty. It never runs again, so a demo the admin clears
  stays cleared. The two backfills are independent: a database that already has `full_page`
  gets only the demos. A fresh database gets them from the seed instead.
- **A save keeps a demo it does not name**, like the capture: `_sync_projects` writes the column
  only when `demo` is in `model_fields_set`, so the first save of an admin tab loaded before the
  deploy keeps every demo; `"demo": ""` still clears one. Each of the two keys is judged on its
  own. DbStore only, as above.
- **Pinned by** the capture's two tests, extended rather than copied: `tests/test_migration.py`
  (the boot adds both columns, fills the shipped values — a demo for `docusafe`, which has no
  capture — leaves the admin's own project empty and never refills a cleared one) and
  `tests/test_api.py` (a save without either key keeps both; a `""` clears only the key it
  names).

## Auth (real)

Admin users live in a DB `users` table with **bcrypt-hashed** passwords. The first admin is
seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup. `POST /api/auth/login` verifies the
hash in constant time (dummy-verify for unknown users) and returns a short-lived JWT that guards
`PUT /api/content`, the `/api/admin/submissions` routes and both image uploads. See
[11 — Security](./11-security.md).

## What remains (Phase 4, optional polish)

The DB, auth, validation, integration and deployment are **done**. Remaining production nice-to-
haves (see [08 — Roadmap](./08-roadmap.md) Phase 4): Alembic migrations (currently `create_all`),
admin-password rotation, rate limiting, and new-submission notifications (email/Telegram). The
authoritative detail lives in [`backend/README.md`](../backend/README.md).

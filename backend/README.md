# TBS Digital — Backend API

FastAPI service that serves the site's editable content and receives contact-form
submissions. It exists so the frontend admin panel and contact form have a real API to
talk to.

> **Status: database + real auth implemented.** Persistence is a **SQL database**
> (SQLModel/SQLAlchemy) — SQLite by default, Postgres via `DATABASE_URL`. Admin login is
> backed by a real `users` table with **bcrypt-hashed** passwords. The storage interface
> is unchanged, so the earlier `JSONFileStore` stays in the tree only as a reference.

## Stack

- **FastAPI** + **Uvicorn**
- **Pydantic v2** / **pydantic-settings** for schemas & config
- **SQLModel** (SQLAlchemy 2) for persistence — SQLite or Postgres (`psycopg[binary]`)
- **bcrypt** for password hashing, **PyJWT** for tokens
- **pytest** + **httpx** for tests
- Tables: `services`, `stats`, `team`, `partners`, `contacts`, `submissions`, `users`.
  `DbStore` (`app/storage/db_store.py`) assembles them into the `SiteContent` document.

## Run it

```bash
cd backend
python -m venv .venv
# Windows:  ./.venv/Scripts/activate      Linux/macOS:  source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env         # then edit the secrets
uvicorn app.main:app --reload --port 8000
```

- Interactive docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

On startup the app creates any missing tables and seeds the default content plus one
admin user (from `ADMIN_USERNAME`/`ADMIN_PASSWORD`, hashed). Seeding is idempotent.

Run the tests with `pytest` (they use an isolated temp SQLite DB, so they don't touch `data/`).

## Configuration (`.env`)

| Var | Default | Purpose |
|-----|---------|---------|
| `APP_NAME` | `TBS Digital API` | Shown in docs/health |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins (the Next.js app) |
| `DATABASE_URL` | `sqlite:///./data/tbs.db` | DB connection. SQLite (default) or `postgresql://…` (uses psycopg v3) |
| `DATA_DIR` | `data` | Legacy — only the `JSONFileStore` reference store uses this |
| `ADMIN_USERNAME` | `admin` | Seeds the admin user's username on first run |
| `ADMIN_PASSWORD` | `change-me` | Seeds the admin user's password (stored bcrypt-hashed) |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing key — **use ≥32 random bytes in prod** |
| `JWT_EXPIRE_MINUTES` | `720` | Token lifetime |

> Changing `ADMIN_PASSWORD` after first run does **not** update the existing DB user
> (seeding only creates a missing user). Update the `users` row directly to rotate it.

## API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/health` | public | Liveness |
| `GET` | `/api/content` | public | Return the whole `SiteContent` document |
| `PUT` | `/api/content` | admin | Replace the whole content document (the admin's Save) |
| `POST` | `/api/contact` | public | Store a contact-form submission |
| `GET` | `/api/admin/submissions` | admin | List submissions (newest first) |
| `POST` | `/api/auth/login` | public | `{username, password}` → `{access_token}` |
| `GET` | `/api/auth/me` | admin | Validate the current token |

Send the token as `Authorization: Bearer <token>` on admin routes.

`SiteContent` mirrors the frontend's `SiteData` (`lib/siteContent.tsx`) exactly:
`stats[]`, `services[]` (with `price` + `estimatorOnly`), `team[]`, `partners[]`, `contacts[]`.
So `GET`/`PUT /api/content` is a drop-in for the current localStorage store.

## Auth — DB-backed users → JWT

- Admin accounts live in the `users` table with **bcrypt-hashed** passwords. The first
  admin is seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup.
- `POST /api/auth/login` looks up the user and verifies the password against the stored
  hash (constant-time, with a dummy verify for unknown users to blunt timing enumeration),
  then returns a short-lived JWT.
- The JWT guards `PUT /api/content` and `GET /api/admin/submissions`.
- The token issuing/guarding and the `/api/auth/*` request/response contract are
  unchanged from the earlier stand-in — only the credential check moved into the DB
  (`app/security.py::authenticate`).

## Input validation & security

Every value entering the API is validated and sanitised at the request boundary via
Pydantic v2 (`app/schemas.py` + reusable helpers in `app/validators.py`). Violations
return **HTTP 422**.

- **Length caps** on every string field: id ≤64, name/role/project ≤120, short labels
  (stat value/label, estimate) ≤80, price ≤40, description/bio ≤2000, contact value ≤254,
  email ≤254, phone 6–40, message ≤5000. **Required, non-empty (after trim)**: contact-form
  `name` + `message`, and `email`.
- **Whitespace** is trimmed on all strings; **control characters** are rejected (tab /
  newline / carriage-return allowed for multi-line text).
- **Email**: validated with `pydantic.EmailStr` (backed by `email-validator`). Contact-book
  values of `type: email` are shape-checked too.
- **Phone**: permissive regex — digits, spaces, `+`, `-`, `()` only.
- **XSS / script injection — sanitised (not rejected) for stored free-text**: names, roles,
  labels, prices, descriptions, bios, partner names, contact values and the contact-form
  fields are **HTML-escaped** (`html.escape`), so `<script>…`, event-handler attributes and
  raw tags become inert (`&lt;script&gt;…`) and can never execute when rendered. Escaping is
  applied once on write; reads use `model_construct` so values are never double-escaped.
- **URL / link fields**: any value using a dangerous scheme (`javascript:`, `data:`,
  `vbscript:`, `file:`) is **rejected**; a contact value of `type: other` that looks like a
  URL must use `http`/`https`.
- **ids** are rejected unless they match a safe slug charset (`[A-Za-z0-9_.:-]`, 1–64).
- **SQL injection**: the DB layer (`app/storage/db_store.py`) and auth
  (`app/security.py`) use **only** the SQLModel/SQLAlchemy ORM with **bound parameters** —
  no raw SQL, no f-string/`.format`/concatenation building statements. A SQLi payload is
  stored as literal text and cannot alter query structure.
- **Flood / DoS defence in depth**: each content list in a `PUT /api/content` is capped at
  **200 items** (`MAX_LIST_ITEMS`), and a request-size middleware rejects bodies over
  **1 MB** with **HTTP 413** before parsing.

## Project structure

```
backend/
├─ app/
│  ├─ main.py            # FastAPI app, CORS, routers, /health
│  ├─ config.py          # Settings (.env) — incl. DATABASE_URL
│  ├─ schemas.py         # Pydantic models = the API contract (mirror lib/siteContent.tsx)
│  ├─ validators.py      # Reusable input sanitisers/validators (anti-XSS/injection)
│  ├─ defaults.py        # Seed content (mirrors lib/content.ts)
│  ├─ db.py              # Engine/session wiring (SQLite or Postgres), create_all
│  ├─ models.py          # SQLModel tables (services/stats/team/partners/contacts/…/users)
│  ├─ seed.py            # Idempotent startup seeding (content + admin user)
│  ├─ security.py        # DB-backed users (bcrypt) -> JWT
│  ├─ deps.py            # get_store() → DbStore (backed by DATABASE_URL)
│  ├─ storage/
│  │  ├─ base.py         # ContentStore interface
│  │  ├─ db_store.py     # DbStore — the active persistence
│  │  └─ json_store.py   # JSONFileStore (reference/fallback, not wired)
│  └─ routers/           # auth, content, contact
├─ data/                 # runtime SQLite DB / JSON (gitignored)
├─ tests/                # pytest smoke + DB tests (isolated temp SQLite)
├─ requirements.txt / requirements-dev.txt
└─ .env.example
```

## Implementation notes (DB + auth)

The storage seam (`app/storage/base.py`) is unchanged; `DbStore` implements it against
SQLModel/SQLAlchemy and is wired in `app/deps.py::get_store()`.

- **Tables** (`app/models.py`): each content list is its own table with a `position`
  column so `get_content` reassembles the `SiteContent` in the admin's saved order.
  `PUT /api/content` → `save_content` does a delete-missing + upsert-by-`id` for the
  id-bearing lists and a wholesale replace for `partners` (a plain `list[str]`).
- **Engine** (`app/db.py`): built once from `DATABASE_URL`. SQLite creates its parent
  dir automatically; a `postgresql://` URL is normalised to the psycopg (v3) driver.
- **Startup** (`app/main.py` lifespan): `create_db_and_tables()` then `seed_database()`.
- **Auth** (`app/security.py`): `authenticate` does a DB user lookup + bcrypt verify.
- **Migrations**: tables are created via `SQLModel.metadata.create_all`. If the schema
  starts evolving, introduce Alembic — the models are ready for it.
- **Deploy**: containerize (`uvicorn`/`gunicorn`), point `DATABASE_URL` at Postgres,
  set a strong `JWT_SECRET`, and set CORS for the production frontend origin.

### Frontend integration (later, not done here)

When the API is ready, the frontend swap is small and lives in `lib/siteContent.tsx`:

- Load content from `GET /api/content` instead of `localStorage` (keep localStorage as an
  offline fallback if desired).
- Admin **Save** → `PUT /api/content` with the bearer token.
- Replace the `tbs2026` PIN gate with the `POST /api/auth/login` form + `GET /api/auth/me`.
- Contact form → `POST /api/contact`.

Set `NEXT_PUBLIC_API_URL` on the frontend and point it at this service.

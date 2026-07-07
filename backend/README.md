# TBS Digital — Backend API

FastAPI service that serves the site's editable content and receives contact-form
submissions. It exists so the frontend admin panel and contact form have a real API to
talk to.

> **Status: pre-database phase.** Persistence is a temporary **JSON file** stand-in.
> The database and its migrations are the **colleague's task** — this codebase is built
> around a storage interface so that swap is isolated (see [Handoff](#handoff--what-the-colleague-does)).

## Stack

- **FastAPI** + **Uvicorn**
- **Pydantic v2** / **pydantic-settings** for schemas & config
- **PyJWT** for the auth stand-in
- **pytest** + **httpx** for tests
- No database yet — a `JSONFileStore` writes `data/content.json` and `data/submissions.json`.

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

Run the tests with `pytest` (they use an isolated temp data dir, so they don't touch `data/`).

## Configuration (`.env`)

| Var | Default | Purpose |
|-----|---------|---------|
| `APP_NAME` | `TBS Digital API` | Shown in docs/health |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins (the Next.js app) |
| `DATA_DIR` | `data` | Where the JSON stand-in writes its files |
| `ADMIN_USERNAME` | `admin` | Admin login (stand-in) |
| `ADMIN_PASSWORD` | `change-me` | Admin password (stand-in) |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing key — **use ≥32 random bytes in prod** |
| `JWT_EXPIRE_MINUTES` | `720` | Token lifetime |

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

## Auth — the chosen option (documented)

Of the options considered, this repo implements **env-credentials → JWT**:

- Admin `username`/`password` live in `.env`; `POST /api/auth/login` verifies them
  (constant-time) and returns a short-lived JWT.
- The JWT guards `PUT /api/content` and `GET /api/admin/submissions`.
- **This is a stand-in, not production auth** — no user accounts, no password hashing,
  single admin. It exists so the frontend can build a real login flow now. The colleague
  replaces the credential check with DB-backed, hashed-password users behind the same
  `app/security.py` functions.

## Project structure

```
backend/
├─ app/
│  ├─ main.py            # FastAPI app, CORS, routers, /health
│  ├─ config.py          # Settings (.env)
│  ├─ schemas.py         # Pydantic models = the API contract (mirror lib/siteContent.tsx)
│  ├─ defaults.py        # Seed content (mirrors lib/content.ts)
│  ├─ security.py        # Auth stand-in: env creds -> JWT
│  ├─ deps.py            # get_store() — swap the store implementation here
│  ├─ storage/
│  │  ├─ base.py         # ContentStore interface  ← the seam to implement
│  │  └─ json_store.py   # JSONFileStore stand-in (TEMPORARY)
│  └─ routers/           # auth, content, contact
├─ data/                 # runtime JSON (gitignored)
├─ tests/                # pytest smoke tests
├─ requirements.txt / requirements-dev.txt
└─ .env.example
```

## Handoff — what the colleague does

The API, schemas, routers and auth flow are done. Wiring a real database means implementing
**one interface** and swapping it in — nothing above the storage layer changes.

1. **Implement `ContentStore` with a database** (`app/storage/base.py` defines it):
   `get_content`, `save_content`, `list_submissions`, `add_submission`. Suggested stack:
   SQLModel/SQLAlchemy + Alembic; SQLite is fine to start, Postgres via a connection string.
   Model the entities as tables (services, stats, team, partners, contacts, submissions) and
   assemble/return a `SiteContent` in `get_content`. `PUT` replaces the whole document, so
   `save_content` upserts each list (delete-missing + insert/update by `id`).
2. **Swap it in** — change the one line in `app/deps.py::get_store()` to return your
   `DbStore`. Add DB settings (`DATABASE_URL`) to `app/config.py`.
3. **Seed** the initial content from `app/defaults.py::default_content()` in your first
   migration (same values the frontend ships).
4. **Real auth** — replace the credential check in `app/security.py::authenticate` with a DB
   user lookup + hashed passwords (e.g. `passlib[bcrypt]`). Keep the JWT issuing/guard as-is
   or extend it. Use a strong `JWT_SECRET`.
5. **Contact submissions** — optional: add email/Telegram notification on `add_submission`.
6. **Deploy** — containerize (`uvicorn`/`gunicorn`), set env + CORS for the production
   frontend origin, run migrations on deploy.

### Frontend integration (later, not done here)

When the API is ready, the frontend swap is small and lives in `lib/siteContent.tsx`:

- Load content from `GET /api/content` instead of `localStorage` (keep localStorage as an
  offline fallback if desired).
- Admin **Save** → `PUT /api/content` with the bearer token.
- Replace the `tbs2026` PIN gate with the `POST /api/auth/login` form + `GET /api/auth/me`.
- Contact form → `POST /api/contact`.

Set `NEXT_PUBLIC_API_URL` on the frontend and point it at this service.

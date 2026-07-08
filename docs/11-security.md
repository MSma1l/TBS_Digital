# 11 — Security & Input Validation

Every value entering the system is validated **twice** — once in the browser (fast feedback,
UX) and once on the server (the real security boundary). The frontend checks can be bypassed;
the backend checks cannot, so the backend is authoritative.

## Where validation lives

| Layer | File | Role |
|-------|------|------|
| Frontend | `lib/validation.ts` | Shared, typed helpers reused by the contact form and the admin editor. |
| Backend | `backend/app/validators.py` + `backend/app/schemas.py` | Pydantic v2 field validators — the enforced boundary (HTTP 422 on violation). |

The two layers mirror the same limits on purpose. If they ever drift, the **backend wins**.

## Rules enforced

### Length limits
Every string field is capped so no input can flood the DB or the UI:

| Field | Max |
|-------|-----|
| name / role / project | 120 |
| stat value / label / estimate | 80 |
| price | 40 / 60 |
| description / bio | 2000 |
| contact value / email | 254 |
| phone | 6–40 |
| contact message | 5000 |

Required fields (contact `name`, `email`, `message`) must be non-empty **after trimming**.
Each content list (services, stats, team, partners, contacts) is capped at **200 items**
(`MAX_LIST_ITEMS`) so a `PUT /api/content` can't be used to flood the database.

### XSS / script injection — sanitized, not just blocked
Free-text stored fields are **HTML-escaped on write** (`<script>` → `&lt;script&gt;`), so
malicious markup can never execute when rendered. Escaping is applied **once** on write; DB
reads use `model_construct` to avoid double-escaping. The frontend additionally blocks
`<script`, `javascript:`, `on*=` event handlers, and raw HTML tags before submit
(`hasDangerousContent` / `sanitizeText` in `lib/validation.ts`).

### Email, phone, URLs
- **Email:** validated with `pydantic.EmailStr` (backend) + regex (frontend).
- **Phone:** permissive regex — digits, spaces, `+ - ( )`, 6–40 chars.
- **URLs / links:** only `http`/`https` schemes accepted. `javascript:`, `data:`, `vbscript:`,
  `file:` schemes are **rejected** everywhere.
- Control characters are rejected; whitespace is trimmed.

### SQL injection
The DB layer (`backend/app/storage/db_store.py`, `backend/app/security.py`) uses **only** the
SQLModel/SQLAlchemy ORM with bound parameters — no raw SQL, f-strings, or `.format()`. A SQLi
payload like `'; DROP TABLE users;--` is stored as literal text and cannot affect the schema.

### Request-body size guard
A middleware in `backend/app/main.py` rejects request bodies larger than **1 MB** with HTTP
413 before they are parsed.

## Authentication
- Admin users live in the DB `users` table with **bcrypt-hashed** passwords
  (`backend/app/security.py`). Login (`POST /api/auth/login`) verifies the hash in constant
  time (with a dummy verify for unknown users to avoid timing leaks) and returns a short-lived
  JWT. The JWT guards `PUT /api/content` and `GET /api/admin/submissions`.
- The first admin is **seeded** from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on startup
  (`backend/app/seed.py`), hashed. Changing `ADMIN_PASSWORD` after first run does **not**
  rotate an existing user's password — add a rotation step if you need it.
- Use a strong `JWT_SECRET` (≥32 random bytes: `openssl rand -hex 32`).

## Verification
Backend security is covered by `backend/tests/test_api.py` (20 tests), including oversized
input → 422, stored `<script>` escaped, invalid email → 422, empty required → 422, and a SQLi
string left inert. Run `make test` (Docker) or `make test-local` (venv).

## What to still do for production
- Add rate limiting on `POST /api/contact` and `POST /api/auth/login` (e.g. slowapi / a
  reverse-proxy limit) to stop brute-force and spam.
- Serve everything over HTTPS behind a reverse proxy; don't expose Postgres publicly.
- Consider Alembic migrations before the schema changes in production (currently `create_all`).

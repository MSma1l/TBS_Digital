# Security

This document records the defensive pentest of TBS Digital, the hardening applied, and the
residual/accepted items. It is the source of truth for the app's security posture.

- **Audit:** 4 read-only pentest passes (auth/JWT/IDOR · injection/SSRF/ReDoS · rate-limit/DoS ·
  exposure/headers/CORS/secrets).
- **Result:** all CRITIC and ÎNALT findings fixed; MEDIU fixed or accepted with mitigation;
  SCĂZUT fixed. Regression tests added for every fix.
- **Verification:** backend **48** pytest · frontend **83** vitest · **27/27** live API checks
  (`scripts/verify-api.sh`) · lint + build clean.

## Findings & status

| # | Finding | Severity | Status | Where fixed |
|---|---------|----------|--------|-------------|
| C1 | JWT secret had a hardcoded default; app booted with a known signing key | CRITIC | **Fixed** | Production fail-fast guard (`config.py`) |
| C2 | Default admin creds (`admin`/`change-me`) seeded, no guard | CRITIC | **Fixed** | Same guard rejects default password in production |
| A1 | CORS `allow_credentials=True` (+ `*`-capable origins) | ÎNALT | **Fixed** | `allow_credentials=False`, narrowed methods/headers (`main.py`); guard rejects `CORS=*` in prod |
| A2 | No production fail-fast on unsafe config | ÎNALT | **Fixed** | `Settings._guard_production` (`config.py`) |
| R1 | No rate limit on `POST /api/auth/login` (brute-force) | ÎNALT | **Fixed** | slowapi `5/minute` (`routers/auth.py`) |
| R2 | Login = CPU-DoS amplifier (bcrypt each attempt) | ÎNALT | **Fixed** | Rate limit throttles before bcrypt |
| R3 | Contact form floodable (DB fill + Telegram ban) | ÎNALT | **Fixed** | slowapi `10/minute` (`routers/contact.py`) |
| T1 | Telegram `/register` hijack — any group member could repoint all leads | ÎNALT | **Fixed** | `is_authorized` allowlist + pinned-group (`telegram/`) |
| H1 | Security headers missing (clickjacking/nosniff/HSTS/CSP) | MEDIU | **Fixed** | Headers middleware (`main.py`) + `next.config.ts` |
| H2 | `GET /api/admin/submissions` unbounded (no pagination) | MEDIU | **Fixed** | `limit`/`offset` (`routers/contact.py`, `db_store.py`) |
| H3 | Body-size guard bypassable (chunked / no Content-Length) | MEDIU | **Fixed** | Streaming `BodySizeLimitMiddleware` (`main.py`) |
| H4 | Unbounded submission storage | MEDIU | **Mitigated** | Rate limit + pagination; retention policy = Phase 4 |
| M1 | Admin JWT in `localStorage` (XSS theft) | MEDIU | **Accepted+mitigated** | CSP/headers shrink XSS surface; token TTL cut to 2h; stored content HTML-escaped |
| M2 | Long token lifetime, no revocation | MEDIU | **Mitigated** | `jwt_expire_minutes` default 720→120; server-side revocation = Phase 4 |
| D1 | Postgres port published in base compose | MEDIU | **Documented** | `docker-compose.prod.yml` overrides to `ports: []`; run both files in prod |
| T2 | `/stats` + classification buttons open to any group member | SCĂZUT | **Fixed** | Authorized via `is_authorized` (`telegram/worker.py`) |
| S1 | bcrypt 72-byte truncation (password collision) | SCĂZUT | **Fixed** | SHA-256+base64 pre-hash (`security.py`) |
| S2 | No JWT `aud`/`iss` | SCĂZUT | **Fixed** | `aud`/`iss` = `tbs-digital`, validated on decode (`security.py`) |
| S3 | Stored `email` not HTML-escaped (symmetry) | SCĂZUT | **Fixed** | `StoredEmail` escaper (`schemas.py`) |
| S4 | `validateText` ran regex before length | SCĂZUT | **Fixed** | Length-before-regex (`lib/validation.ts`) |

## Verified secure (no change needed)

- **SQL injection:** 100% ORM/parameterized; zero raw SQL / `text()` / f-string queries.
- **Stored XSS:** every user-writable string HTML-escaped on write; Telegram messages
  re-escaped on render (`parse_mode=HTML`) with a double-escape guard.
- **SSRF:** the only outbound HTTP is the Telegram client on a **fixed** host with a literal
  method name — no user URL is ever fetched.
- **Telegram injection:** topic names come from a fixed lookup; `callback_data` is built from a
  server uuid + fixed status keys and re-validated against `STATUS_KEYS`.
- **ReDoS:** all regexes linear; format checks run on length-capped input.
- **JWT algorithm:** pinned to HS256 with an explicit allow-list (anti `alg=none`/confusion).
- **Auth coverage:** every write/admin route behind the bearer guard; no IDOR (single global
  content doc + admin-only submissions); no mass-assignment (`status`/`id` server-set).
- **Secrets:** no real token/password committed; `.env`/`backend/.env` gitignored; examples are
  placeholders. Containers run non-root; no secret baked into image layers.

## Production checklist (enforced by the guard)

Set `ENVIRONMENT=production` and the app **refuses to boot** unless:

- `JWT_SECRET` is set, not the default, and ≥ 32 chars (`openssl rand -hex 32`).
- `ADMIN_PASSWORD` is set and not the default.
- `CORS_ORIGINS` does not contain `*`.

Also recommended in production:

- Pin `TELEGRAM_GROUP_CHAT_ID` and set `TELEGRAM_ADMIN_IDS` (locks `/register`, `/stats`, and
  lead buttons to named admins).
- Run behind HTTPS / a reverse proxy; run compose with both files so Postgres isn't public.

## Remaining (Phase 4, non-blocking)

Server-side token revocation (logout truly ends the session), submission retention/pruning,
optional httpOnly-cookie admin session, and Alembic migrations. See
[docs/08-roadmap.md](docs/08-roadmap.md).

## How security is organized

Reusable, per-topic security skills live in `.claude/skills/security-*` and are indexed in
[docs/15-security-skills.md](docs/15-security-skills.md). Tests: `backend/tests/test_security_*.py`,
`lib/__tests__/validation*.test.ts`, and the live `scripts/verify-api.sh`.

---
name: security-rate-limiting
description: Protect against brute-force and DoS — per-IP rate limits on login/contact, streaming body-size cap, pagination, list caps, authorized Telegram actions. Use when adding a public endpoint or reviewing DoS/abuse surface in TBS Digital, or when the user asks about "rate limiting / brute force / spam / DoS".
---

# Rate limiting & DoS protection

## Rate limits — `backend/app/main.py` + routers (slowapi)
- `POST /api/auth/login` → `5/minute` per IP (stops password brute-force + bcrypt CPU-DoS).
- `POST /api/contact` → `10/minute` per IP (stops spam floods that fill the DB / ban the Telegram bot).
- Limiter keyed on client IP, honors `X-Forwarded-For`; `limiter.enabled = settings.rate_limit_enabled`
  (disabled in tests). Over-limit → **429**.

## Payload / result bounds
- `BodySizeLimitMiddleware` (`main.py`): streams and caps the request body at **1 MB** (covers
  chunked / missing Content-Length), returns **413**.
- `PUT /api/content`: `MAX_LIST_ITEMS = 200` per list + per-field length caps (`schemas.py`).
- `GET /api/admin/submissions`: paginated `limit` (default 50, max 200) + `offset`.

## Telegram abuse — `backend/app/telegram/`
- `/register`, `/stats`, and lead-classification buttons are authorized via `is_authorized`
  (`telegram_admin_id_set` allowlist + pinned/registered group). Pin `TELEGRAM_GROUP_CHAT_ID` and
  set `TELEGRAM_ADMIN_IDS` in production.

## Verify
- `backend/tests/test_security_http.py` (Nth login → 429, >1MB → 413, pagination bounds).
- `backend/tests/test_security_authz.py` (unauthorized Telegram action denied).

## Phase 4 (not yet)
Retention/pruning of submissions, honeypot/CAPTCHA on the form, edge (nginx) rate limits.

Related: [[security-auth-jwt]], [[security-pentest]].
